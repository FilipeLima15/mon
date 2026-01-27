import requests
import os
from datetime import datetime, timedelta

GOLD_API_KEY = os.getenv("GOLD_API_KEY", "").strip()
PUSH_USER = os.getenv("PUSH_USER", "").strip()
PUSH_TOKEN = os.getenv("PUSH_TOKEN", "").strip()

def buscar_preco(data_especifica=None):
    # Se data_especifica for None, pega o preço atual. 
    # Se tiver data (formato YYYYMMDD), pega o histórico.
    url = f"https://www.goldapi.io/api/XAU/USD/{data_especifica}" if data_especifica else "https://www.goldapi.io/api/XAU/USD"
    headers = {"x-access-token": GOLD_API_KEY, "Content-Type": "application/json"}
    
    try:
        response = requests.get(url, headers=headers)
        return response.json().get('price')
    except:
        return None

def enviar_push(titulo, mensagem):
    url = "https://api.pushover.net/1/messages.json"
    dados = {
        "token": PUSH_TOKEN, "user": PUSH_USER,
        "message": mensagem, "title": titulo,
        "priority": 1, "sound": "cashregister"
    }
    requests.post(url, data=dados)

# --- LÓGICA PRINCIPAL ---
agora = datetime.now() - timedelta(hours=3) # Ajuste para Horário de Brasília
hora_atual = agora.hour

preco_agora = buscar_preco()

if preco_agora:
    # 1. Se for 10h da manhã, faz a comparação de 24h
    if hora_atual == 10:
        data_ontem = (agora - timedelta(days=1)).strftime('%Y%m%d')
        preco_ontem = buscar_preco(data_ontem)
        
        if preco_ontem:
            variacao = (preco_agora / preco_ontem) - 1
            if variacao <= -0.03:
                msg = f"🚨 QUEDA DE {abs(variacao)*100:.1f}%!\nOntem: ${preco_ontem:.2f}\nAgora: ${preco_agora:.2f}"
                enviar_push("Alerta de Oportunidade", msg)
            else:
                enviar_push("Cotação 10h", f"Ouro: ${preco_agora:.2f}\nSem queda de 3% desde ontem.")
    
    # 2. Nos outros horários (15h e 20h), apenas envia o preço
    else:
        enviar_push("Cotação Atual", f"Ouro: ${preco_agora:.2f} às {hora_atual}h")

print(f"Processado às {hora_atual}h. Preço: {preco_agora}")
