import requests
import os

# Puxando as chaves que você configurou no GitHub
# O .strip() remove qualquer espaço ou quebra de linha invisível
GOLD_API_KEY = os.getenv("GOLD_API_KEY").strip()
PUSH_USER = os.getenv("PUSH_USER").strip()
PUSH_TOKEN = os.getenv("PUSH_TOKEN").strip()

def buscar_preco_ouro():
    url = "https://www.goldapi.io/api/XAU/BRL"
    # Adicionamos 'Content-Type' para ajudar a API a entender o pedido
    headers = {
        "x-access-token": GOLD_API_KEY,
        "Content-Type": "application/json"
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        dados = response.json()
        return dados.get('price')
    else:
        print(f"Erro na GoldAPI: Status {response.status_code}")
        print(f"Mensagem: {response.text}")
        return None

def enviar_push(preco):
    url = "https://api.pushover.net/1/messages.json"
    dados = {
        "token": PUSH_TOKEN,
        "user": PUSH_USER,
        "message": f"💰 Ouro: R$ {preco:.2f}",
        "title": "Cotação Atual",
        "priority": 1
    }
    response = requests.post(url, data=dados)
    # Isso vai escrever na tela preta do GitHub o que o Pushover respondeu:
    print(f"Resposta do Pushover: {response.status_code} - {response.text}")

# Execução
valor = buscar_preco_ouro()
if valor:
    enviar_push(valor)
    print(f"Sucesso! Notificação enviada com o valor R$ {valor}")
else:
    print("Falha ao obter preço. Verifique o log acima.")
