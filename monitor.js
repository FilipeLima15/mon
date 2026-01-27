const axios = require('axios');

// Recuperando as variáveis de ambiente (Secrets do GitHub)
const GOLD_API_KEY = process.env.GOLD_API_KEY ? process.env.GOLD_API_KEY.trim() : "";
const PUSH_USER = process.env.PUSH_USER ? process.env.PUSH_USER.trim() : "";
const PUSH_TOKEN = process.env.PUSH_TOKEN ? process.env.PUSH_TOKEN.trim() : "";

// Função para buscar o preço (atual ou histórico)
async function buscarPreco(dataEspecifica = null) {
    let url = "https://www.goldapi.io/api/XAU/USD";
    if (dataEspecifica) {
        // A API espera o formato na URL, ex: .../USD/20231027
        url = `https://www.goldapi.io/api/XAU/USD/${dataEspecifica}`;
    }

    const config = {
        headers: {
            "x-access-token": GOLD_API_KEY,
            "Content-Type": "application/json"
        }
    };

    try {
        const response = await axios.get(url, config);
        return response.data.price;
    } catch (error) {
        console.error("Erro ao buscar preço:", error.message);
        return null;
    }
}

// Função para enviar notificação Push
async function enviarPush(titulo, mensagem) {
    const url = "https://api.pushover.net/1/messages.json";
    const dados = {
        token: PUSH_TOKEN,
        user: PUSH_USER,
        message: mensagem,
        title: titulo,
        priority: 1,
        sound: "cashregister"
    };

    try {
        await axios.post(url, dados);
        console.log("Push enviado:", titulo);
    } catch (error) {
        console.error("Erro ao enviar push:", error.message);
    }
}

// Função auxiliar para formatar data em YYYYMMDD
function formatarData(data) {
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, '0');
    const dd = String(data.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

// --- LÓGICA PRINCIPAL ---
(async () => {
    // 1. Ajuste de fuso horário (UTC -> Brasília -3h)
    const agoraUtc = new Date();
    const agoraBrasilia = new Date(agoraUtc.getTime() - (3 * 60 * 60 * 1000));
    
    const horaAtual = agoraBrasilia.getUTCHours(); // Pega a hora do objeto ajustado

    console.log(`Hora Brasília: ${horaAtual}h`);

    // 2. Busca preço atual
    const precoAgora = await buscarPreco();

    if (precoAgora) {
        // Cenário 1: Se for 10h da manhã, compara com ontem
        if (horaAtual === 10) {
            // Calcula o dia anterior (Ontem)
            const ontem = new Date(agoraBrasilia);
            ontem.setDate(ontem.getDate() - 1);
            const dataOntemStr = formatarData(ontem);

            console.log(`Comparando com data: ${dataOntemStr}`);
            const precoOntem = await buscarPreco(dataOntemStr);

            if (precoOntem) {
                const variacao = (precoAgora / precoOntem) - 1;
                
                // Se cair 3% ou mais (ex: -0.03)
                if (variacao <= -0.03) {
                    const pctQueda = Math.abs(variacao) * 100;
                    const msg = `🚨 QUEDA DE ${pctQueda.toFixed(1)}%!\nOntem: $${precoOntem.toFixed(2)}\nAgora: $${precoAgora.toFixed(2)}`;
                    await enviarPush("Alerta de Oportunidade", msg);
                } else {
                    const msg = `Ouro: $${precoAgora.toFixed(2)}\nSem queda de 3% desde ontem.`;
                    await enviarPush("Cotação 10h", msg);
                }
            }
        } 
        // Cenário 2: Outros horários (15h, 20h), apenas informa
        else {
            const msg = `Ouro: $${precoAgora.toFixed(2)} às ${horaAtual}h`;
            await enviarPush("Cotação Atual", msg);
        }
    }

    console.log(`Processado. Preço final: ${precoAgora}`);
})();
