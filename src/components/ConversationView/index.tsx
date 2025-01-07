import axios from "axios";
import { head, last } from "lodash-es";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  getAssistantById,
  getPromptGeneratorOfAssistant,
  useConversationStore,
  useMessageStore,
  useConnectionStore,
  useSettingStore,
  useLayoutStore,
  useUserStore,
} from "@/store";
import { Conversation, CreatorRole, Message } from "@/types";
import { countTextTokens, generateUUID, getModel, hasFeature, generateDbPromptFromContext } from "@/utils";
import getEventEmitter from "@/utils/event-emitter";
import Header from "./Header";
import EmptyView from "../EmptyView";
import MessageView from "./MessageView";
import ClearConversationButton from "../ClearConversationButton";
import MessageTextarea from "./MessageTextarea";
import DataStorageBanner from "../DataStorageBanner";
import SchemaDrawer from "../SchemaDrawer";
import Icon from "../Icon";
import { useTranslation } from "react-i18next";

const ConversationView = () => {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const settingStore = useSettingStore();
  const layoutStore = useLayoutStore();
  const connectionStore = useConnectionStore();
  const conversationStore = useConversationStore();
  const userStore = useUserStore();
  const messageStore = useMessageStore();
  const [isStickyAtBottom, setIsStickyAtBottom] = useState<boolean>(true);
  const [showHeaderShadow, setShowHeaderShadow] = useState<boolean>(false);
  const conversationViewRef = useRef<HTMLDivElement>(null);
  const currentConversation = conversationStore.getConversationById(conversationStore.currentConversationId);
  const messageList = currentConversation
    ? messageStore.messageList.filter((message: Message) => message.conversationId === currentConversation.id)
    : [];
  const lastMessage = last(messageList);
  const [showSchemaDrawer, setShowSchemaDrawer] = useState<boolean>(false);

  useEffect(() => {
    messageStore.messageList.map((message: Message) => {
      if (message.status === "LOADING") {
        if (message.content === "") {
          messageStore.updateMessage(message.id, {
            content: "Failed to send the message.",
            status: "FAILED",
          });
        } else {
          messageStore.updateMessage(message.id, {
            status: "DONE",
          });
        }
      }
    });

    const handleConversationViewScroll = () => {
      if (!conversationViewRef.current) {
        return;
      }
      setShowHeaderShadow((conversationViewRef.current?.scrollTop || 0) > 0);
      setIsStickyAtBottom(
        conversationViewRef.current.scrollTop + conversationViewRef.current.clientHeight >= conversationViewRef.current.scrollHeight
      );
    };
    conversationViewRef.current?.addEventListener("scroll", handleConversationViewScroll);

    return () => {
      conversationViewRef.current?.removeEventListener("scroll", handleConversationViewScroll);
    };
  }, []);

  useEffect(() => {
    if (!conversationViewRef.current) {
      return;
    }
    conversationViewRef.current.scrollTop = conversationViewRef.current.scrollHeight;
  }, [currentConversation, lastMessage?.id]);

  useEffect(() => {
    if (!conversationViewRef.current) {
      return;
    }

    if (lastMessage?.status === "LOADING" && isStickyAtBottom) {
      conversationViewRef.current.scrollTop = conversationViewRef.current.scrollHeight;
    }
  }, [lastMessage?.status, lastMessage?.content, isStickyAtBottom]);

  useEffect(() => {
    if (
      currentConversation?.connectionId === connectionStore.currentConnectionCtx?.connection.id &&
      currentConversation?.databaseName === connectionStore.currentConnectionCtx?.database?.name
    ) {
      return;
    }

    // Auto select the first conversation when the current connection changes.
    const conversationList = conversationStore.conversationList.filter(
      (conversation: Conversation) =>
        conversation.connectionId === connectionStore.currentConnectionCtx?.connection.id &&
        conversation.databaseName === connectionStore.currentConnectionCtx?.database?.name
    );
    conversationStore.setCurrentConversationId(head(conversationList)?.id);
  }, [currentConversation, connectionStore.currentConnectionCtx]);

  const sendMessageToCurrentConversation = async (userPrompt: string) => {
    if (!currentConversation) {
      return;
    }

    const userMessage: Message = {
      id: generateUUID(),
      conversationId: currentConversation.id,
      creatorId: userStore.currentUser.id,
      creatorRole: CreatorRole.User,
      createdAt: Date.now(),
      content: userPrompt,
      status: "DONE",
    };
    messageStore.addMessage(userMessage);

    const formatedMessageList = messageList
      .filter((message) => message.status === "DONE")
      .map((message) => ({
        role: message.creatorRole === CreatorRole.System ? "system" : message.creatorRole === CreatorRole.User ? "user" : "assistant",
        content: message.content,
      }));

    // Get the current database type and context
    const currentConnection = connectionStore.currentConnectionCtx?.connection;
    const currentDatabase = connectionStore.currentConnectionCtx?.database;
    const dbContext = {
      type: currentConnection?.engineType || "",
      name: currentDatabase?.name || "",
      version: "", // Version is not available in the current connection context
    };

    const sqlContextPrompt = `你是一个专注于text2sql的AI助手。当前数据库环境：
- 类型: ${dbContext.type}
- 名称: ${dbContext.name}
- 版本: ${dbContext.version}

请严格遵循以下规则：

1. 数据库特定性：
   - 只提供${dbContext.type}数据库的SQL语句
   - 使用${dbContext.type} ${dbContext.version}版本的特定语法
   - 不显示其他数据库类型的SQL

2. 查询理解：
   - 将包含数字的名称（如user001）视为完整的表名
   - 默认查询表的所有内容
   - 使用标准的${dbContext.type}语法格式

3. 响应要求：
   - 提供可直接执行的${dbContext.type}SQL语句
   - 给出简洁的中文解释
   - 说明预期的查询结果
   - 如果遇到语法错误，提供修正建议

示例：当用户说"查询user001表"时，应该生成适用于${dbContext.type}的查询语句，如：
SELECT * FROM user001;`;

    // Format messages based on provider
    const baseMessages = [
      ...formatedMessageList,
      {
        role: "user",
        content: `[${dbContext.type}] ${userPrompt}`,
      },
    ];

    let messages;
    if (settingStore.setting.activeProvider === "qwen") {
      // Internal Qwen
      messages = [
        {
          role: "system",
          content: `你是由山东电力开发的人工智能智能助手，如果别人询问你的身份或名字，请务必说自己叫"文心一言"。

${sqlContextPrompt}`,
        },
        ...baseMessages,
      ];
    } else if (settingStore.setting.dashScopeApiConfig?.key) {
      // External DashScope
      messages = [
        {
          role: "system",
          content: sqlContextPrompt,
        },
        ...baseMessages,
      ];
    } else {
      // OpenAI
      messages = [
        {
          role: "system",
          content: sqlContextPrompt,
        },
        ...baseMessages,
      ];
    }

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (settingStore.setting.activeProvider === "qwen") {
      requestHeaders["x-provider"] = "qwen";
      requestHeaders["x-qwen-endpoint"] = settingStore.setting.qwenApiConfig?.endpoint ?? "";
      requestHeaders["x-qwen-app-id"] = settingStore.setting.qwenApiConfig?.appId ?? "";
      requestHeaders["x-qwen-secret-key"] = settingStore.setting.qwenApiConfig?.secretKey ?? "";
    } else if (settingStore.setting.openAIApiConfig?.key) {
      requestHeaders["x-openai-key"] = settingStore.setting.openAIApiConfig.key;
      if (settingStore.setting.openAIApiConfig.endpoint) {
        requestHeaders["x-openai-endpoint"] = settingStore.setting.openAIApiConfig.endpoint;
      }
      if (settingStore.setting.openAIApiConfig.model) {
        requestHeaders["x-openai-model"] = settingStore.setting.openAIApiConfig.model;
      }
    } else if (settingStore.setting.dashScopeApiConfig?.key) {
      requestHeaders["x-dashscope-key"] = settingStore.setting.dashScopeApiConfig.key;
      requestHeaders["x-provider"] = "dashscope";
      requestHeaders["x-dashscope-model"] = settingStore.setting.dashScopeApiConfig.model;
    }

    const rawRes = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages,
      }),
      headers: requestHeaders,
    });

    if (!rawRes.ok) {
      console.error(rawRes);
      let errorMessage = "Failed to request message, please check your network.";
      try {
        const errorData = await rawRes.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch (error) {
        // do nothing
      }
      messageStore.updateMessage(userMessage.id, {
        content: "",
        status: "FAILED",
        error: errorMessage,
      });
      return;
    }

    const assistantMessage: Message = {
      id: generateUUID(),
      conversationId: currentConversation.id,
      creatorId: currentConversation.assistantId,
      creatorRole: CreatorRole.Assistant,
      createdAt: Date.now(),
      content: "",
      status: "LOADING",
    };
    messageStore.addMessage(assistantMessage);

    try {
      if (settingStore.setting.activeProvider === "qwen") {
        // Handle internal Qwen response (non-streaming)
        const data = await rawRes.json();
        if (data.message?.content) {
          messageStore.updateMessage(assistantMessage.id, {
            content: data.message.content,
            status: "DONE",
          });
        } else {
          messageStore.updateMessage(assistantMessage.id, {
            content: "Invalid response format",
            status: "FAILED",
            error: "Unexpected response from internal Qwen API",
          });
        }
      } else if (settingStore.setting.dashScopeApiConfig?.key) {
        // Handle DashScope streaming response
        const reader = rawRes.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let hasReceivedContent = false;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data:")) {
                try {
                  const jsonData = JSON.parse(line.slice(5));
                  if (jsonData.output?.choices?.[0]?.message?.content) {
                    const newContent = jsonData.output.choices[0].message.content;
                    accumulatedContent += newContent;
                    hasReceivedContent = true;
                    messageStore.updateMessage(assistantMessage.id, {
                      content: accumulatedContent,
                      status: "LOADING",
                    });
                  }
                } catch (e) {
                  console.error("Error parsing JSON:", e);
                }
              }
            }
          }
        }

        messageStore.updateMessage(assistantMessage.id, {
          content: hasReceivedContent ? accumulatedContent : "No response received. Please try again.",
          status: hasReceivedContent ? "DONE" : "FAILED",
          error: hasReceivedContent ? undefined : "No response received from DashScope API",
        });
      } else {
        // Handle OpenAI response
        const data = await rawRes.json();
        if (data.message) {
          messageStore.updateMessage(assistantMessage.id, {
            content: data.message,
            status: "DONE",
          });
        } else {
          messageStore.updateMessage(assistantMessage.id, {
            content: "Invalid response format",
            status: "FAILED",
            error: "Unexpected response from OpenAI API",
          });
        }
      }
    } catch (error) {
      console.error("Error processing response:", error);
      messageStore.updateMessage(assistantMessage.id, {
        content: "",
        status: "FAILED",
        error: "Failed to process response. Please try again.",
      });
    }

    // Emit usage update event so quota widget can update.
    getEventEmitter().emit("usage.update");

    if (hasFeature("collect")) {
      // Collect system prompt
      const usageMessageList = [userMessage, assistantMessage];

      axios
        .post<string[]>(
          "/api/collect",
          {
            conversation: currentConversation,
            messages: usageMessageList,
          },
          {
            headers: requestHeaders,
          }
        )
        .catch(() => {
          // do nth
        });
    }
  };

  return (
    <div
      ref={conversationViewRef}
      className={`${
        layoutStore.showSidebar && "sm:pl-80"
      } relative w-full h-full max-h-full flex flex-col justify-start items-start overflow-y-auto bg-white dark:bg-zinc-800`}
    >
      <div className="sticky top-0 z-1 bg-white dark:bg-zinc-800 w-full flex flex-col justify-start items-start">
        <DataStorageBanner />
        <Header className={showHeaderShadow ? "shadow" : ""} />
      </div>
      <div className="p-2 w-full h-auto grow max-w-4xl py-1 px-4 sm:px-8 mx-auto">
        {messageList.length === 0 ? (
          <EmptyView className="mt-16" sendMessage={sendMessageToCurrentConversation} />
        ) : (
          messageList.map((message: Message) => <MessageView key={message.id} message={message} />)
        )}
      </div>
      <div className="sticky bottom-0 flex flex-row justify-center items-center w-full max-w-4xl py-2 pb-4 px-4 sm:px-8 mx-auto bg-white dark:bg-zinc-800 bg-opacity-80 backdrop-blur">
        <ClearConversationButton />
        <MessageTextarea disabled={lastMessage?.status === "LOADING"} sendMessage={sendMessageToCurrentConversation} />
        <div className="mr-2 relative flex flex-row justify-end items-center" onClick={() => setShowSchemaDrawer(true)}>
          {
            <button className="flex flex-col items-center m-2 text-blue-600 hover:underline">
              <Icon.FiEye className="w-6 h-auto" />
              <span>{t("prompt.self")}</span>
            </button>
          }
        </div>
        {showSchemaDrawer && <SchemaDrawer close={() => setShowSchemaDrawer(false)} />}
      </div>
    </div>
  );
};

export default ConversationView;
