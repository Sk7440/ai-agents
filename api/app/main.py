from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent


@tool
def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"


# 1. Initialize your local Ollama model
model = ChatOllama(
    model="gemma4:31b-cloud",  # or your preferred local model tag
    temperature=0,
)

# 2. Build the agent with tools and prompt
agent = create_react_agent(
    model=model,
    tools=[get_weather],
    prompt="You are a helpful assistant",
)

# 3. Invoke using message list
result = agent.invoke(
    {"messages": [{"role": "user", "content": "What's the weather in Lahore?"}]}
)

# 4. Print the final message content
print(result["messages"][-1].content)