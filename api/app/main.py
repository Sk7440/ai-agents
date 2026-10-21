import json
from langchain.agents import create_agent


def load_gloassary():
    pass

GLOASSARY = load_gloassary()

# Agent tool
def lookup_term(term: str):
    pass

SYSTEM = """
You are a helpful Termloop agent! decribe in 1 line 
"""

agent = create_agent(
    model="ollama:gemma4:31b-cloud",
    tools=[],
    system_prompt=SYSTEM,
)

query = input("Query: ")
result = agent.invoke(
    {"messages": [{"role": "user", "content": query}]}
)
print(result["messages"][-1].text)