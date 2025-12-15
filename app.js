import { auth, db, provider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "./firebase.js";

// Configuração Visual das Categorias (ADICIONEI NOVAS)
const categoryConfig = {
    salary: { label: 'Receita', icon: 'banknote', color: 'text-green-600', bg: 'bg-green-100', type: 'income' },
    freelance: { label: 'Freelance', icon: 'laptop', color: 'text-emerald-600', bg: 'bg-emerald-100', type: 'income' },
    food: { label: 'Alimentação', icon: 'utensils', color: 'text-orange-600', bg: 'bg-orange-100', type: 'expense' },
    transport: { label: 'Transporte', icon: 'car', color: 'text-blue-600', bg: 'bg-blue-100', type: 'expense' },
    home: { label: 'Casa', icon: 'home', color: 'text-indigo-600', bg: 'bg-indigo-100', type: 'expense' },
    education: { label: 'Educação', icon: 'graduation-cap', color: 'text-cyan-600', bg: 'bg-cyan-100', type: 'expense' },
    leisure: { label: 'Lazer', icon: 'gamepad-2', color: 'text-purple-600', bg: 'bg-purple-100', type: 'expense' },
    health: { label: 'Saúde', icon: 'heart', color: 'text-red-600', bg: 'bg-red-100', type: 'expense' },
    invest: { label: 'Investimento', icon: 'trending-up', color: 'text-yellow-600', bg: 'bg-yellow-100', type: 'expense' },
    shopping: { label: 'Compras', icon: 'shopping-bag', color: 'text-pink-600', bg: 'bg-pink-100', type: 'expense' },
    other: { label: 'Outros', icon: 'package', color: 'text-gray-600', bg: 'bg-gray-100', type: 'expense' }
};

// Elementos
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const form = document.getElementById('transaction-form');
const listElement = document.getElementById('transaction-list');
let chartInstance = null;
let currentUser = null;
let unsubscribe = null;
let allTransactions = []; // Guardar dados para exportação

const dateInput = document.getElementById('date');
if(dateInput) dateInput.valueAsDate = new Date();
if(window.lucide) lucide.createIcons();

// --- LOGIN ---
loginBtn.addEventListener('click', async () => {
    try { await signInWithRedirect(auth, provider); } catch (e) { alert("Erro login: " + e.message); }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        userNameDisplay.textContent = user.displayName;
        carregarDados(user.uid);
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        if (unsubscribe) unsubscribe();
        listElement.innerHTML = '';
        renderValues([]);
    }
});

// --- SALVAR NOVO ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const desc = document.getElementById('desc').value;
    const amountVal = parseFloat(document.getElementById('amount').value);
    const dateVal = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    const type = categoryConfig[category].type;
    const finalAmount = type === 'expense' ? -Math.abs(amountVal) : Math.abs(amountVal);

    try {
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid, desc: desc, amount: finalAmount, date: dateVal, category: category, createdAt: new Date()
        });
        form.reset();
        document.getElementById('date').valueAsDate = new Date();
    } catch (error) { console.error("Erro ao salvar:", error); }
});

// --- CARREGAR DADOS ---
function carregarDados(uid) {
    const q = query(collection(db, "transactions"), where("uid", "==", uid));
    unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = [];
        snapshot.forEach(doc => { transactions.push({ id: doc.id, ...doc.data() }); });
        transactions.sort((a, b) => {
            const dateA = a.date ? new Date(a.date) : new Date(0);
            const dateB = b.date ? new Date(b.date) : new Date(0);
            return dateB - dateA;
        });
        
        allTransactions = transactions; // Salva para exportar depois
        renderList(transactions); 
        renderValues(transactions); 
        renderChart(transactions);
    });
}

function renderList(transactions) {
    listElement.innerHTML = '';
    if (transactions.length === 0) {
        listElement.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">Nenhuma movimentação ainda.</td></tr>';
        return;
    }
    transactions.forEach(t => {
        const conf = categoryConfig[t.category] || categoryConfig['other'];
        const isExpense = t.amount < 0;
        const amountClass = isExpense ? 'text-red-600' : 'text-green-600';
        let dataFormatada = "Data inválida";
        try {
            if (t.date && typeof t.date === 'string' && t.date.includes('-')) {
                const parts = t.date.split('-'); 
                dataFormatada = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else if (t.date && t.date.seconds) {
                dataFormatada = new Date(t.date.seconds * 1000).toLocaleDateString('pt-BR');
            } else { dataFormatada = new Date().toLocaleDateString('pt-BR'); }
        } catch (e) { console.log(e); }

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50/50 transition border-b border-gray-50 last:border-0";
        row.innerHTML = `
            <td class="p-4"><div class="flex items-center gap-3"><div class="p-2 rounded-lg ${conf.bg} ${conf.color}"><i data-lucide="${conf.icon}" class="w-4 h-4"></i></div><span class="font-medium text-sm text-gray-700 hidden sm:inline">${conf.label}</span></div></td>
            <td class="p-4 font-medium text-gray-900 text-sm">${t.desc || 'Sem descrição'}</td>
            <td class="p-4 text-sm text-gray-500">${dataFormatada}</td>
            <td class="p-4 text-right font-bold text-sm ${amountClass}">${isExpense ? '-' : '+'} ${Math.abs(t.amount).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
            <td class="p-4 text-center flex justify-center gap-2">
                <button onclick="prepararEdicao('${t.id}', '${t.desc}', ${t.amount}, '${t.date}')" class="text-gray-400 hover:text-indigo-500 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button onclick="deletarItem('${t.id}')" class="text-gray-400 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>`;
        listElement.appendChild(row);
    });
    if(window.lucide) lucide.createIcons();
}

function renderValues(transactions) {
    const amounts = transactions.map(t => t.amount);
    const total = amounts.reduce((acc, item) => acc + item, 0);
    const income = amounts.filter(item => item > 0).reduce((acc, item) => acc + item, 0);
    const expense = amounts.filter(item => item < 0).reduce((acc, item) => acc + item, 0);
    const format = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const elTotal = document.getElementById('display-total'); if(elTotal) elTotal.innerText = format(total);
    const elIncome = document.getElementById('display-income'); if(elIncome) elIncome.innerText = format(income);
    const elExpense = document.getElementById('display-expense'); if(elExpense) elExpense.innerText = format(Math.abs(expense));
    const balMsg = document.getElementById('balance-msg');
    if (balMsg) {
        if(total < 0) { balMsg.innerHTML = '<i data-lucide="alert-circle" class="w-3 h-3"></i> Atenção: Saldo Negativo'; balMsg.className = "text-xs text-red-500 mt-2 flex items-center gap-1 font-bold"; } 
        else { balMsg.innerHTML = 'Balanço positivo'; balMsg.className = "text-xs text-indigo-200 mt-2 flex items-center gap-1"; }
    }
}

function renderChart(transactions) {
    const ctx = document.getElementById('expenseChart');
    const noData = document.getElementById('no-data-msg');
    if(!ctx) return;
    const income = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const expense = Math.abs(transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
    if (income === 0 && expense === 0) { ctx.style.display = 'none'; if(noData) noData.classList.remove('hidden'); if(chartInstance) { chartInstance.destroy(); chartInstance = null; } return; }
    ctx.style.display = 'block'; if(noData) noData.classList.add('hidden');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Entradas', 'Saídas'], datasets: [{ data: [income, expense], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter', size: 12 } } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}` } } }, cutout: '70%' }
    });
}

// --- FUNÇÕES GLOBAIS (Janela de Edição + Deletar + Exportar) ---
window.deletarItem = async (id) => { if(confirm("Apagar registro?")) { await deleteDoc(doc(db, "transactions", id)); } }

window.prepararEdicao = (id, desc, amount, date) => {
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-desc').value = desc;
    document.getElementById('edit-amount').value = Math.abs(amount); // Mostra positivo pra editar
    document.getElementById('edit-date').value = date;
}

window.fecharModal = () => { document.getElementById('edit-modal').classList.add('hidden'); }

// Salvar a edição
document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const desc = document.getElementById('edit-desc').value;
    const amountVal = parseFloat(document.getElementById('edit-amount').value);
    const dateVal = document.getElementById('edit-date').value;

    // Busca o documento original só pra saber se era receita ou despesa (pra manter o sinal)
    // Simplificação: Se estava negativo, continua negativo. Se positivo, positivo.
    // Melhoria: Aqui assumimos que o usuário não muda de "Receita" pra "Despesa" na edição, só ajusta valor.
    // Se quiser mudar o tipo, melhor deletar e criar outro.
    
    // Vamos checar na lista local atual qual era o valor antigo
    const original = allTransactions.find(t => t.id === id);
    const isExpense = original && original.amount < 0;
    const finalAmount = isExpense ? -Math.abs(amountVal) : Math.abs(amountVal);

    try {
        const docRef = doc(db, "transactions", id);
        await updateDoc(docRef, {
            desc: desc,
            amount: finalAmount,
            date: dateVal
        });
        fecharModal();
    } catch (error) {
        console.error("Erro ao editar:", error);
        alert("Erro ao editar!");
    }
});

window.exportarCSV = () => {
    if(!allTransactions.length) return alert("Nada para exportar!");
    let csvContent = "data:text/csv;charset=utf-8,Data,Descrição,Categoria,Valor\n";
    allTransactions.forEach(t => {
        const val = t.amount.toFixed(2).replace('.', ',');
        csvContent += `${t.date},${t.desc},${t.category},"${val}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "meu_extrato_mywallet.csv");
    document.body.appendChild(link);
    link.click();
}