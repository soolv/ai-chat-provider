import { useChat } from "ai/react";
import { createContext, useContext, useEffect, useRef } from "react";

type UseChatArgs = NonNullable<Parameters<typeof useChat>[0]>;

const handlerNames = ["onFinish", "onError", "onResponse"] as const;
export type UseChatHandlerName = (typeof handlerNames)[number];

export type UseChatHandlers = {
  [key in UseChatHandlerName]: NonNullable<UseChatArgs[key]>;
} & {
  onToolCall: Map<string, NonNullable<UseChatArgs["onToolCall"]>>;
};

const initialHandlers = {
  onFinish: new Set<NonNullable<UseChatArgs["onFinish"]>>(),
  onError: new Set<NonNullable<UseChatArgs["onError"]>>(),
  onResponse: new Set<NonNullable<UseChatArgs["onResponse"]>>(),
  onToolCall: new Map<string, NonNullable<UseChatArgs["onToolCall"]>>(),
};

type AiChatProviderValue = {
  chat: ReturnType<typeof useChat>;
  handlers: typeof initialHandlers;
};

const AiChatContext = createContext<AiChatProviderValue | null>(null);

export function useAiChat(args: Partial<UseChatHandlers> = {}) {
  const context = useContext(AiChatContext);

  if (!context) {
    throw new Error("useAiChat must be used within a AiChatProvider");
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: We only run this effect when the handlers themselves change
  useEffect(() => {
    if (args.onFinish) {
      context.handlers.onFinish.add(args.onFinish);
    }
    if (args.onError) {
      context.handlers.onError.add(args.onError);
    }
    if (args.onResponse) {
      context.handlers.onResponse.add(args.onResponse);
    }
    if (args.onToolCall) {
      for (const [key, value] of args.onToolCall) {
        if (context.handlers.onToolCall.has(key)) {
          throw new Error(`Multiple handlers registered for tool "${key}"`);
        }

        context.handlers.onToolCall.set(key, value);
      }
    }

    return () => {
      if (args.onFinish) {
        context.handlers.onFinish.delete(args.onFinish);
      }
      if (args.onError) {
        context.handlers.onError.delete(args.onError);
      }
      if (args.onResponse) {
        context.handlers.onResponse.delete(args.onResponse);
      }
      if (args.onToolCall) {
        for (const [key] of args.onToolCall) {
          context.handlers.onToolCall.delete(key);
        }
      }
    };
  }, [args.onFinish, args.onError, args.onResponse, args.onToolCall]);

  return context.chat;
}

export function AiChatProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Omit<
    UseChatArgs,
    "onFinish" | "onError" | "onResponse" | "onToolCall"
  >;
}) {
  const handlers = useRef(initialHandlers);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Need to reset handlers when value changes
  useEffect(() => {
    handlers.current = initialHandlers;
  }, [value]);

  const chat = useChat({
    ...value,
    onError(...args) {
      for (const handler of handlers.current.onError) {
        handler(...args);
      }
    },
    onFinish(...args) {
      for (const handler of handlers.current.onFinish) {
        handler(...args);
      }
    },
    async onResponse(...args) {
      for (const handler of handlers.current.onResponse) {
        await handler(...args);
      }
    },
    async onToolCall({ toolCall, ...args }) {
      const handler = handlers.current.onToolCall.get(toolCall.toolName);
      if (handler) {
        return handler({ toolCall, ...args });
      }
      console.warn(`No handler for tool call ${toolCall.toolName}`);
    },
  });

  return (
    <AiChatContext.Provider
      value={{
        chat,
        handlers: handlers.current,
      }}
    >
      {children}
    </AiChatContext.Provider>
  );
}
