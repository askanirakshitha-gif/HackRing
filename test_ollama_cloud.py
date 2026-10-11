import os
import sys
from dotenv import load_dotenv
from openai import OpenAI

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv("backend/.env")

api_key = os.getenv("OLLAMA_API_KEY") or "972b69578d7a4dcbbe636dc1cd289fb6.uHIxa8o7lalIzLsDeR-B8EqS"
model = os.getenv("OLLAMA_MODEL", "gpt-oss:120b-cloud")

print(f"Connecting to Ollama Cloud ({model})...")
client = OpenAI(
    base_url="https://ollama.com/v1",
    api_key=api_key,
)

response = client.chat.completions.create(
    model=model,
    messages=[
        {
            "role": "user",
            "content": "Say hello to MindMesh AI Teacher Co-Pilot in 1 short sentence."
        }
    ],
)

reply = response.choices[0].message.content
print("\n✅ Successfully connected to Ollama Cloud!")
print(f"Model: {model}")
print(f"Reply: {reply}")