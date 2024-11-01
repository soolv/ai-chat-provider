import { withTestServer } from "@ai-sdk/provider-utils/test";
import { formatStreamPart } from "@ai-sdk/ui-utils";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { useChat } from "ai/react";
import { vi } from "vitest";
import { afterEach, describe, expect, test } from "vitest";
import { AiChatProvider, useAiChat } from "./index";
import "@testing-library/jest-dom";

type UseChatArgs = NonNullable<Parameters<typeof useChat>[0]>;
const ButtonId = "button-test-id";
const Messages = () => {
  const { messages, append } = useAiChat();

  return (
    <div>
      {messages.map((m, idx) => (
        <div data-testid={`message-${idx}`} key={m.id}>
          {m.toolInvocations?.map((toolInvocation, toolIdx) =>
            "result" in toolInvocation ? (
              <div
                key={toolInvocation.toolCallId}
                data-testid={`tool-invocation-${toolIdx}`}
              >
                {toolInvocation.result}
              </div>
            ) : null,
          )}
        </div>
      ))}

      <button
        type="button"
        data-testid={ButtonId}
        onClick={() => {
          append({ role: "user", content: "hi" });
        }}
      />
    </div>
  );
};

describe("AiChatProvider", () => {
  test("renders children correctly", () => {
    render(
      <AiChatProvider value={{}}>
        <div>Test Child</div>
      </AiChatProvider>,
    );

    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });

  test("throws error when useAiChat is used outside AiChatProvider", () => {
    const TestComponent = () => {
      useAiChat();
      return null;
    };

    expect(() => render(<TestComponent />)).toThrow(
      "useAiChat must be used within a AiChatProvider",
    );
  });

  describe("onFinish", () => {
    const TestComponent = ({
      onFinish,
    }: { onFinish: NonNullable<UseChatArgs["onFinish"]> }) => {
      const { messages } = useAiChat({ onFinish });
      return <div>{messages.length}</div>;
    };

    afterEach(() => {
      vi.restoreAllMocks();
      cleanup();
    });

    test(
      "calls onFinish handler correctly",
      withTestServer(
        {
          url: "/api/chat",
          type: "stream-values",
          content: [
            formatStreamPart("text", ","),
            formatStreamPart("text", " world"),
            formatStreamPart("text", "."),
            formatStreamPart("finish_message", {
              finishReason: "stop",
              usage: { completionTokens: 2, promptTokens: 333 },
            }),
          ],
        },
        async () => {
          const onFinish = vi.fn();
          render(
            <AiChatProvider
              value={{
                initialMessages: [],
              }}
            >
              <TestComponent onFinish={onFinish} />
              <Messages />
            </AiChatProvider>,
          );
          await userEvent.click(screen.getByTestId(ButtonId));
          expect(onFinish).toHaveBeenCalledTimes(1);
        },
      ),
    );
  });

  describe("onToolCall", () => {
    const ToolHandlerComponent = ({
      toolCallHandlers,
    }: {
      toolCallHandlers: Map<string, NonNullable<UseChatArgs["onToolCall"]>>;
    }) => {
      const { messages } = useAiChat({
        onToolCall: toolCallHandlers,
      });
      return <div>{messages.length}</div>;
    };

    afterEach(() => {
      vi.restoreAllMocks();
      cleanup();
    });

    test(
      "calls tool handler correctly",
      withTestServer(
        {
          url: "/api/chat",
          type: "stream-values",
          content: [
            formatStreamPart("tool_call", {
              toolCallId: "tool-call-0",
              toolName: "test-tool",
              args: { testArg: "test-value" },
            }),
          ],
        },
        async () => {
          render(
            <AiChatProvider
              value={{
                initialMessages: [],
              }}
            >
              <ToolHandlerComponent
                toolCallHandlers={
                  new Map([
                    [
                      "test-tool",
                      async ({ toolCall }) => {
                        const { toolCallId, toolName, args } = toolCall;
                        return `test-tool-response: ${toolName} ${toolCallId} ${JSON.stringify(args)}`;
                      },
                    ],
                  ])
                }
              />
              <Messages />
            </AiChatProvider>,
          );
          await userEvent.click(screen.getByTestId(ButtonId));

          await screen.findByTestId("message-1");
          expect(screen.getByTestId("message-1")).toHaveTextContent(
            'test-tool-response: test-tool tool-call-0 {"testArg":"test-value"}',
          );
        },
      ),
    );

    test(
      "does not call tool handler when toolName does not match",
      withTestServer(
        {
          url: "/api/chat",
          type: "stream-values",
          content: [
            formatStreamPart("tool_call", {
              toolCallId: "tool-call-0",
              toolName: "test-tool",
              args: { testArg: "test-value" },
            }),
          ],
        },
        async () => {
          render(
            <AiChatProvider
              value={{
                initialMessages: [],
              }}
            >
              <ToolHandlerComponent
                toolCallHandlers={
                  new Map([
                    [
                      "another-tool",
                      async () => {
                        return "should not be called";
                      },
                    ],
                  ])
                }
              />
              <Messages />
            </AiChatProvider>,
          );
          await userEvent.click(screen.getByTestId(ButtonId));

          await screen.findByTestId("message-1");
          expect(screen.getByTestId("message-1")).not.toHaveTextContent(
            "should not be called",
          );
        },
      ),
    );

    test("throws if multiple handlers are registered for the same tool", () => {
      expect(() => {
        render(
          <AiChatProvider
            value={{
              initialMessages: [],
            }}
          >
            <ToolHandlerComponent
              toolCallHandlers={
                new Map([
                  [
                    "test-tool",
                    async ({ toolCall }) => {
                      const { toolCallId, toolName, args } = toolCall;
                      return `test-tool-response: ${toolName} ${toolCallId} ${JSON.stringify(args)}`;
                    },
                  ],
                ])
              }
            />
            <ToolHandlerComponent
              toolCallHandlers={
                new Map([
                  [
                    "test-tool",
                    async ({ toolCall }) => {
                      const { toolCallId, toolName, args } = toolCall;
                      return `test-tool-response: ${toolName} ${toolCallId} ${JSON.stringify(args)}`;
                    },
                  ],
                ])
              }
            />
            <Messages />
          </AiChatProvider>,
        );
      }).toThrow('Multiple handlers registered for tool "test-tool"');
    });
  });
});
