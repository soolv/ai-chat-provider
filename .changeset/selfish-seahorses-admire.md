---
"@soolv/ai-chat-provider": major
---

Fixes handling of tool calls

The breaking change is that toolCall now takes in a Map instead of a function.
There can only be one handler per toolName.