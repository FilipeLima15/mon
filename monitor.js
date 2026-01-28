const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- CONFIGURAÇÕES ---
const ARQUIVO_DADOS = path.join(__dirname, 'dados.json');
const GOLD_API_KEY = process.env.GOLD_API_KEY ? process.env.GOLD_API_KEY.trim() : "";
const PUSH_USER = process.env.PUSH_USER ? process.env.PUSH_USER.trim() : "";
const PUSH_TOKEN = process.env.PUSH_TOKEN ? process.env.PUSH_TOKEN.trim() : "";

// --- FUNÇÕES AUXILIARES ---
async function buscarPreco() {
    const url = "https://www.goldapi.io/api/XAU/USD";
    try {
        const response = await axios.get(url, { headers: { "x-access-token": GOLD_API_KEY } });
        return response.data.price;
    } catch (error) {
        console.error("Erro API:", error.message);
        return null;
    }
}

async function enviarPush(titulo, mensagem) {
    try {
        await axios.post("https://api.pushover.net/1/messages.json", {
            token: PUSH_TOKEN, user: PUSH_USER,
            message: mensagem, title: titulo, priority: 1, sound: "cashregister"
        });
        console.log("Push enviado:", titulo);
    } catch (e) { console.error("Erro Push:", e.message); }
}

function carregarDados() {
    if (fs.existsSync(ARQUIVO_DADOS)) {
        const dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
        // Garante que a lista de histórico exista (para versões antigas do arquivo)
        if (!dados.historico) dados.historico = [];
        return dados;
    }
    return {
        ultima_verificacao_3dias: "20000101",
        preco_referencia_3dias: 0,
        preco_segunda_passada: 0,
        data_segunda_passada: "",
        preco_ultimo_fechamento: 0,
        historico: [] // <--- AQUI ESTÁ A SUA LISTA INFINITA
    };
}

function salvarDados(dados) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
}

function formatarData(date) {
    return date.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
}

function formatarDataBonita(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function dataLegivel(dateStr) {
    if (!dateStr || dateStr.length !== 8) return "";
    return `${dateStr.substr(6,2)}/${dateStr.substr(4,2)}`;
}

// --- LÓGICA PRINCIPAL ---
(async () => {
    // 1. Hora de Brasília
    const agoraUtc = new Date();
    const agoraBr = new Date(agoraUtc.getTime() - (3 * 60 * 60 * 1000));
    const horaAtual = agoraBr.getUTCHours();
    const diaSemana = agoraBr.getDay(); // 0=Dom, 1=Seg...
    const hojeStr = formatarData(agoraBr);
    const dataLog = formatarDataBonita(agoraBr);

    console.log(`Hora BR: ${horaAtual}h | Data: ${hojeStr}`);

    // Janela de execução da manhã (10h até 12h) para driblar atrasos do GitHub
    const isManha = (horaAtual >= 10 && horaAtual <= 12);

    const precoAgora = await buscarPreco();
    
    if (!precoAgora) {
        console.log("Falha ao obter preço. Encerrando.");
        return;
    }

    let mensagemFinal = "";
    let tituloFinal = isManha ? "C.10h" : "C.A";
    let dados = carregarDados();
    let dadosAlterados = false;

    // A. MENSAGEM BÁSICA
    mensagemFinal += `${precoAgora.toFixed(2)}`;
    if (!isManha) mensagemFinal += ` às ${horaAtual}h`;

    // --- BLOCO DA MANHÃ (Executa e Salva Dados) ---
    if (isManha) {
        console.log("Janela da manhã detectada. Atualizando histórico...");

        // 1. ADICIONAR AO HISTÓRICO INFINITO
        // Verifica se já não salvou hoje para não duplicar se rodar 2x na mesma manhã
        const jaSalvouHoje = dados.historico.some(h => h.data === dataLog);
        if (!jaSalvouHoje) {
            dados.historico.push({
                data: dataLog,
                valor: precoAgora,
                dia_semana: diaSemana
            });
            console.log("Adicionado ao histórico infinito.");
        }
        
        // 2. COMPARAÇÃO COM ONTEM
        const precoOntem = dados.preco_ultimo_fechamento || 0;
        if (precoOntem > 0) {
            const varOntem = (precoAgora / precoOntem) - 1;
            if (varOntem <= -0.03) {
                tituloFinal = "Analisar";
                mensagemFinal += `\n🚨 Queda diária: ${(varOntem*100).toFixed(1)}%`;
                mensagemFinal += `\n(Ontem: ${precoOntem.toFixed(2)})`;
            }
        }

        // 3. CICLO DE 3 DIAS
        const ano = parseInt(dados.ultima_verificacao_3dias.substring(0, 4));
        const mes = parseInt(dados.ultima_verificacao_3dias.substring(4, 6)) - 1;
        const dia = parseInt(dados.ultima_verificacao_3dias.substring(6, 8));
        const ultimaData3d = new Date(ano, mes, dia);

        const d1 = new Date(agoraBr.getFullYear(), agoraBr.getMonth(), agoraBr.getDate());
        const d2 = new Date(ultimaData3d.getFullYear(), ultimaData3d.getMonth(), ultimaData3d.getDate());
        const diffTempo = d1 - d2;
        const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));

        if (diffDias >= 3) {
            const refPreco = dados.preco_referencia_3dias || precoAgora;
            if (refPreco > 0) {
                const var3d = (precoAgora / refPreco) - 1;
                if (var3d <= -0.03) {
                    tituloFinal = "Analisar (3d)";
                    mensagemFinal += `\n📉 Ciclo 3 Dias: ${(var3d*100).toFixed(1)}%`;
                }
            }
            dados.ultima_verificacao_3dias = hojeStr;
            dados.preco_referencia_3dias = precoAgora;
            dadosAlterados = true;
        }

        // 4. RELATÓRIO DE SEGUNDA-FEIRA
        if (diaSemana === 1) { 
            const refSegunda = dados.preco_segunda_passada || 0;
            const dataRef = dados.data_segunda_passada;

            if (refSegunda > 0) {
                const varSemana = (precoAgora / refSegunda) - 1;
                const simbolo = varSemana >= 0 ? "+" : "";
                
                mensagemFinal += `\n\n📅 Semanal (${dataLegivel(dataRef)}):`;
                mensagemFinal += `\n${simbolo}${(varSemana*100).toFixed(1)}% (Era: ${refSegunda.toFixed(2)})`;
            }
            dados.preco_segunda_passada = precoAgora;
            dados.data_segunda_passada = hojeStr;
            dadosAlterados = true;
        }

        // Atualiza referência de "Ontem"
        dados.preco_ultimo_fechamento = precoAgora;
        dadosAlterados = true;
    }

    await enviarPush(tituloFinal, mensagemFinal);

    if (dadosAlterados) {
        salvarDados(dados);
        console.log("Dados salvos no JSON.");
    }
})();
