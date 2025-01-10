import { Drawer } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useConnectionStore, useConversationStore, useLayoutStore, ResponsiveWidth, useSettingStore } from "@/store";
import { Engine, Table, Schema } from "@/types";
import useLoading from "@/hooks/useLoading";
import Select from "./kit/Select";
import Icon from "./Icon";
import DarkModeSwitch from "./DarkModeSwitch";
import ConnectionList from "./Sidebar/ConnectionList";
import QuotaView from "./QuotaView";
import { countTextTokens, getModel, hasFeature } from "../utils";
import SettingAvatarIcon from "./SettingAvatarIcon";
import Checkbox from "./kit/Checkbox";
import { head } from "lodash-es";
import Link from 'next/link';
import toast from 'react-hot-toast';

interface State {}

const ConnectionSidebar = () => {
  const { t } = useTranslation();
  const layoutStore = useLayoutStore();
  const connectionStore = useConnectionStore();
  const conversationStore = useConversationStore();
  const settingStore = useSettingStore();
  const currentConnectionCtx = connectionStore.currentConnectionCtx;
  const databaseList = connectionStore.databaseList.filter((database) => database.connectionId === currentConnectionCtx?.connection.id);
  const [tableList, updateTableList] = useState<Table[]>([]);
  const [schemaList, updateSchemaList] = useState<Schema[]>([]);
  const tableSchemaLoadingState = useLoading();
  const currentConversation = conversationStore.getConversationById(conversationStore.currentConversationId);
  const maxToken = getModel(settingStore.setting.openAIApiConfig?.model || "").max_token;
  const [totalToken, setTotalToken] = useState<number>(0);
  const hasSchemaProperty: boolean =
    currentConnectionCtx?.connection.engineType === Engine.PostgreSQL || currentConnectionCtx?.connection.engineType === Engine.MSSQL;
  const selectedTableNameList: string[] = currentConversation?.selectedTableNameList || [];
  const selectedSchemaName: string = currentConversation?.selectedSchemaName || "";

  useEffect(() => {
    console.log('Component mounted');
    console.log('Current connection context:', currentConnectionCtx);
  }, []);

  useEffect(() => {
    console.log('Connection context changed:', currentConnectionCtx);
    console.log('Selected schema name:', selectedSchemaName);
    
    const schemaList =
      connectionStore.databaseList.find(
        (database) =>
          database.connectionId === currentConnectionCtx?.connection.id && database.name === currentConnectionCtx?.database?.name
      )?.schemaList || [];

    console.log('Found schema list:', schemaList);
    updateSchemaList(schemaList);
    
    // 更新表列表
    if (hasSchemaProperty && schemaList.length > 0) {
      // 如果有schema属性，使用选中的schema的表
      const selectedSchema = schemaList.find((schema) => schema.name === selectedSchemaName);
      console.log('Selected schema and its tables:', selectedSchema);
      updateTableList(selectedSchema?.tables || []);
    } else {
      // 如果没有schema属性，使用第一个schema的表
      console.log('Using first schema and its tables:', schemaList[0]);
      updateTableList(schemaList[0]?.tables || []);
    }

    // need to create a conversation. otherwise updateSelectedSchemaName will failed.
    createConversation();
  }, [connectionStore, hasSchemaProperty, currentConnectionCtx, selectedSchemaName]);

  useEffect(() => {
    console.log('Table list changed:', tableList);
  }, [tableList]);

  useEffect(() => {
    if (!currentConnectionCtx?.connection) {
      console.log('No connection context available');
      return;
    }

    // 立即获取数据库列表，不等待缓存检查
    console.log('Fetching database list...');
    connectionStore.getOrFetchDatabaseList(currentConnectionCtx.connection, true).then((databaseList) => {
      console.log('Fetched database list:', databaseList);
      // 如果没有选择数据库，选择第一个
      if (!currentConnectionCtx.database && databaseList.length > 0) {
        console.log('Setting first database as current:', databaseList[0]);
        connectionStore.setCurrentConnectionCtx({
          connection: currentConnectionCtx.connection,
          database: databaseList[0],
        });
      }
    }).catch(error => {
      console.error('Error fetching database list:', error);
      toast.error('加载数据库列表失败，请检查连接配置');
    });
  }, [currentConnectionCtx?.connection]);

  useEffect(() => {
    const handleWindowResize = () => {
      const width = window.innerWidth;
      if (width >= ResponsiveWidth.sm) {
        layoutStore.toggleSidebar(true);
      } else {
        layoutStore.toggleSidebar(false);
      }
    };

    window.addEventListener("resize", handleWindowResize);
    handleWindowResize();

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  useEffect(() => {
    const totalToken = selectedTableNameList.reduce((totalToken, tableName) => {
      const table = tableList.find((t) => t.name === tableName);
      // because old cache didn't have token, So the value may is undefined.
      return totalToken + (table?.token || countTextTokens(table?.structure || ""));
    }, 0);
    setTotalToken(totalToken);
  }, [selectedTableNameList, tableList]);

  useEffect(() => {
    if (hasSchemaProperty && selectedSchemaName === "" && schemaList.length > 0) {
      conversationStore.updateSelectedSchemaName(head(schemaList)?.name || "");
    }
  }, [schemaList, currentConversation]);

  const handleDatabaseNameSelect = async (databaseName: string) => {
    console.log('Selecting database:', databaseName);
    if (!currentConnectionCtx?.connection) {
      console.log('No current connection context');
      return;
    }

    const database = connectionStore.databaseList.find(
      (db) => db.connectionId === currentConnectionCtx.connection.id && db.name === databaseName
    );

    if (!database) {
      console.error('Selected database not found in list');
      return;
    }

    console.log('Setting selected database:', database);
    connectionStore.setCurrentConnectionCtx({
      connection: currentConnectionCtx.connection,
      database: database,
    });

    // Fetch schema immediately after selecting database
    try {
      console.log('Fetching schema for database:', database);
      tableSchemaLoadingState.setLoading();
      const schema = await connectionStore.getOrFetchDatabaseSchema(database, true);
      console.log('Fetched schema:', schema);
      updateSchemaList(schema);
      if (schema.length > 0 && schema[0].tables) {
        updateTableList(schema[0].tables);
      }
    } catch (error) {
      console.error('Error fetching schema:', error);
      toast.error('Failed to load table schema');
    } finally {
      tableSchemaLoadingState.setFinish();
    }
  };

  const syncDatabaseList = async () => {
    if (!currentConnectionCtx?.connection) {
      console.log('No connection context in syncDatabaseList');
      return;
    }

    console.log('Syncing database list for connection:', currentConnectionCtx.connection);
    try {
      const prevDatabase = currentConnectionCtx.database;
      const databaseList = await connectionStore.getOrFetchDatabaseList(currentConnectionCtx.connection, true);
      console.log('Synced database list:', databaseList);

      // Retain the existing database if it exists in the new database list.
      const database = databaseList.find((database) => database.name === prevDatabase?.name);
      console.log('Found matching database:', database);
      
      connectionStore.setCurrentConnectionCtx({
        connection: currentConnectionCtx.connection,
        database: database ? database : databaseList[0],
      });

      // Fetch schema for the selected database
      if (database) {
        console.log('Fetching schema for database:', database);
        tableSchemaLoadingState.setLoading();
        try {
          const schema = await connectionStore.getOrFetchDatabaseSchema(database, true);
          console.log('Fetched schema:', schema);
          updateSchemaList(schema);
          if (schema.length > 0 && schema[0].tables) {
            updateTableList(schema[0].tables);
          }
        } catch (error) {
          console.error('Error fetching schema:', error);
          toast.error('Failed to load table schema');
        } finally {
          tableSchemaLoadingState.setFinish();
        }
      }
    } catch (error) {
      console.error('Error syncing database list:', error);
      toast.error('Failed to sync database list');
    }
  };

  // only create conversation when currentConversation is null.
  // Note: This function is used to solve issue #95
  //       https://github.com/sqlchat/sqlchat/issues/95
  const createConversation = () => {
    if (!currentConversation) {
      if (!currentConnectionCtx) {
        conversationStore.createConversation();
      } else {
        conversationStore.createConversation(currentConnectionCtx.connection.id, currentConnectionCtx.database?.name);
      }
    }
  };

  const handleTableCheckboxChange = async (tableName: string, value: boolean) => {
    if (value) {
      conversationStore.updateSelectedTablesNameList([...selectedTableNameList, tableName]);
    } else {
      conversationStore.updateSelectedTablesNameList(selectedTableNameList.filter((name) => name !== tableName));
    }
  };

  const handleSchemaNameSelect = async (schemaName: string) => {
    // need to empty selectedTableNameList when schemaName changed. because selectedTableNameList may not exist in new schema.
    conversationStore.updateSelectedTablesNameList([]);
    conversationStore.updateSelectedSchemaName(schemaName);
  };

  return (
    <>
      <Drawer
        className="!z-10"
        variant={layoutStore.isMobileView ? "temporary" : "persistent"}
        open={layoutStore.showSidebar}
        onClose={() => layoutStore.toggleSidebar(false)}
        ModalProps={{ disablePortal: true }}
      >
        <div className="w-80 h-full overflow-y-hidden flex flex-row justify-start items-start">
          <div className="w-16 h-full bg-gray-200 dark:bg-zinc-600 pl-2 py-4 pt-6 flex flex-col justify-between items-center">
            <div className="w-full flex flex-col justify-start items-start">
              <ConnectionList />
            </div>
            <div className="w-full flex flex-col space-y-2 justify-end items-center">
              <DarkModeSwitch />
              <SettingAvatarIcon />
            </div>
          </div>
          <div className="relative p-4 pb-0 w-64 h-full overflow-y-auto flex flex-col justify-start items-start bg-gray-100 dark:bg-zinc-700">
            <img className="px-4 shrink-0" src="/chat-logo.webp" alt="" />
            <div className="w-full grow">
              {connectionStore.isRequestingDatabase ? (
                <div className="w-full h-12 flex flex-row justify-start items-center px-4 sticky top-0 border z-1 mb-4 mt-4 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                  <Icon.BiLoaderAlt className="w-4 h-auto animate-spin mr-1" /> {t("common.loading")}
                </div>
              ) : (
                currentConnectionCtx && (
                  <button
                    onClick={() => syncDatabaseList()}
                    className="flex space-x-1 items-center justify-center mb-4 mt-4 w-full px-2 py-1 border rounded-lg dark:text-gray-300 bg-white dark:bg-zinc-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Icon.BiRefresh className="h-6 w-auto" />
                    <span>{t("connection.refresh-schema")}</span>
                  </button>
                )
              )}
              {databaseList.length > 0 && (
                <div className="w-full sticky top-0 z-1">
                  <Select
                    className="w-full px-4 py-3 !text-base"
                    value={currentConnectionCtx?.database?.name}
                    itemList={databaseList.map((database) => {
                      return {
                        label: database.name,
                        value: database.name,
                      };
                    })}
                    onValueChange={(databaseName) => handleDatabaseNameSelect(databaseName)}
                    placeholder={t("connection.select-database") || ""}
                  />
                </div>
              )}
              {hasSchemaProperty && schemaList.length > 0 && (
                <Select
                  className="w-full px-4 py-3 !text-base mt-2"
                  value={selectedSchemaName}
                  itemList={schemaList.map((schema) => {
                    return {
                      label: schema.name,
                      value: schema.name,
                    };
                  })}
                  onValueChange={(schema) => handleSchemaNameSelect(schema)}
                  placeholder={t("connection.select-schema") || ""}
                />
              )}

              {currentConnectionCtx && !tableSchemaLoadingState.isLoading && (
                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mt-3 mb-2 px-1">
                  <div>{t("connection.total-token")}</div>
                  <div>
                    {totalToken}/{maxToken}
                  </div>
                </div>
              )}

              {currentConnectionCtx &&
                (tableSchemaLoadingState.isLoading ? (
                  <div className="w-full h-12 flex flex-row justify-start items-center px-4 sticky top-0 z-1 mb-4 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                    <Icon.BiLoaderAlt className="w-4 h-auto animate-spin mr-1" /> {t("common.loading")}
                  </div>
                ) : (
                  tableList.length > 0 &&
                  tableList.map((table) => {
                    return (
                      <div key={table.name}>
                        <Checkbox
                          value={selectedTableNameList.includes(table.name)}
                          label={table.name}
                          onValueChange={handleTableCheckboxChange}
                        >
                          <div className="text-gray-700 text-sm dark:text-gray-300">{table.token || countTextTokens(table.structure)}</div>
                        </Checkbox>
                      </div>
                    );
                  })
                ))}
            </div>

            <div className="sticky bottom-0 w-full flex flex-col justify-center bg-gray-100 dark:bg-zinc-700 backdrop-blur bg-opacity-60 pb-4 py-2">
              {!settingStore.setting.openAIApiConfig?.key && hasFeature("quota") && (
                <div className="mb-4">
                  <QuotaView />
                </div>
              )}
              <Link
                href="/api-management"
                className="w-full px-3 py-2 rounded-lg text-sm text-left transition-all flex flex-row justify-between items-center hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  API 管理
                </span>
                <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 px-2 py-1 rounded">
                  NEW
                </span>
              </Link>
              <a
                className="dark:hidden"
                href="https://www.producthunt.com/posts/sql-chat-2?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-sql&#0045;chat&#0045;2"
                target="_blank"
              >
                <img
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=390216&theme=light"
                  alt="SQL&#0032;Chat - ChatGPT&#0032;powered&#0032;SQL&#0032;client&#0032;for&#0032;Postgres&#0044;&#0032;MySQL&#0032;&#0038;&#0032;SQL&#0032;Server | Product Hunt"
                  style={{ width: "250px", height: "54px" }}
                  width="250"
                  height="54"
                />
              </a>
              <a
                className="hidden dark:block"
                href="https://www.producthunt.com/posts/sql-chat-2?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-sql&#0045;chat&#0045;2"
                target="_blank"
              >
                <img
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=390216&theme=dark"
                  alt="SQL&#0032;Chat - ChatGPT&#0032;powered&#0032;SQL&#0032;client&#0032;for&#0032;Postgres&#0044;&#0032;MySQL&#0032;&#0038;&#0032;SQL&#0032;Server | Product Hunt"
                  style={{ width: "250px", height: "54px" }}
                  width="250"
                  height="54"
                />
              </a>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
};

export default ConnectionSidebar;
