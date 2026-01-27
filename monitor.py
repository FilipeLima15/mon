import requests
import os
from datetime import datetime

# Limpeza de chaves
GOLD_API_KEY = os.getenv("GOLD_API_KEY", "").strip()
PUSH_USER = os.getenv("PUSH_USER", "").strip()
PUSH_TOKEN = os.getenv("PUSH_TOKEN", "").strip()

def buscar_preco_ouro():
    # Vamos tentar em Dólar (USD) primeiro, que é o padrão global da API
    url = "https://www.goldapi.io/api/XAU/USD"
    headers = {
        "x-access-token": GOLD_API_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        dados = response.json()
        
        if response.status_code == 200 and 'price' in dados:
            return dados['price']
        else:
            print(f"Erro detalhado da API: {dados}")
            return None
    except Exception as e:
        print(f"Erro de conexão: {e}")
        return None

def enviar_push(preco):
    agora = datetime.now().strftime("%H:%M")
    url = "https://api.pushover.net/1/messages.json"
    dados = {
        "token": PUSH_TOKEN,
        "user": PUSH_USER,
        "message": f"💰 Ouro: ${preco:.2f} (USD) às {agora}",
        "title": "Cotação Atualizada",
        "priority": 1,
        "sound": "cashregister"
    }
    requests.post(url, data=dados)

# Fluxo principal
preco_atual = buscar_preco_ouro()
if preco_atual:
    enviar_push(preco_atual)
    print(f"Sucesso! Preço ${preco_atual} enviado.")
else:
    print("A GoldAPI negou o acesso. Verifique se a chave GOLD_API_KEY no GitHub está idêntica à do site.")
