import requests
import os

# Puxando as chaves
PUSH_USER = os.getenv("PUSH_USER").strip()
PUSH_TOKEN = os.getenv("PUSH_TOKEN").strip()

def enviar_push_teste():
    url = "https://api.pushover.net/1/messages.json"
    dados = {
        "token": PUSH_TOKEN,
        "user": PUSH_USER,
        "message": "🚀 TESTE FINAL: O robô está vivo!",
        "title": "GitHub de Ouro",
        "priority": 1
    }
    response = requests.post(url, data=dados)
    print(f"Resposta do Pushover: {response.status_code} - {response.text}")

# Rodar apenas o Push, sem perguntar o preço para a GoldAPI
enviar_push_teste()
