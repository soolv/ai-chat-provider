# @soolv/ai-chat-provider

## 1.0.0

### Major Changes

- e93863a: Fixes handling of tool calls

  The breaking change is that toolCall now takes in a Map instead of a function.
  There can only be one handler per toolName.
