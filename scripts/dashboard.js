const SUPABASE_URL = 'https://vplqvgnwlmbxdtmbmwnk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbHF2Z253bG1ieGR0bWJtd25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzIyNzgsImV4cCI6MjA4NTU0ODI3OH0.OfHZDNXIbQPo3-vbLnT0u0OoZ3jIoxG1FjfQbAAs1gk';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class DashboardSystem {
    constructor() {
        this.currentUser = null;
        this.currentRole = 'user';
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.loadUserData();
        this.checkPermissions();
        this.loadPlayers();
        this.loadUsersForAdmin();
    }

    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            window.location.href = 'index.html';
            return;
        }

        this.currentUser = session.user;
        await this.getUserRole();
    }

    async getUserRole() {
        const { data, error } = await supabase
            .from('profiles')
            .select('role, username')
            .eq('id', this.currentUser.id)
            .single();

        if (!error && data) {
            this.currentRole = data.role;
            document.getElementById('user-role-display').textContent = data.role;
            document.getElementById('user-name').textContent = data.username;
            document.getElementById('user-avatar').textContent = 
                data.username.charAt(0).toUpperCase();
        }
    }

    checkPermissions() {
        // Показать/скрыть панели в зависимости от роли
        const adminSection = document.getElementById('admin-section');
        const ownerSection = document.getElementById('owner-section');

        if (this.currentRole === 'admin' || this.currentRole === 'owner') {
            adminSection.style.display = 'block';
        }

        if (this.currentRole === 'owner') {
            ownerSection.style.display = 'block';
        }
    }

    setupEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });

        // Выход
        document.getElementById('btn-logout').addEventListener('click', () => {
            this.handleLogout();
        });

        // Добавление игрока
        document.getElementById('btn-add-player').addEventListener('click', () => {
            this.toggleAddPlayerForm();
        });

        document.getElementById('btn-save-player').addEventListener('click', () => {
            this.savePlayer();
        });

        // Назначение администратора
        document.getElementById('btn-make-admin').addEventListener('click', () => {
            this.makeAdmin();
        });
    }

    switchTab(tabId) {
        // Скрыть все вкладки
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Показать выбранную вкладку
        const tabElement = document.getElementById(`${tabId}-tab`);
        if (tabElement) {
            tabElement.classList.add('active');
        }

        // Обновить активную кнопку навигации
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            }
        });
    }

    toggleAddPlayerForm() {
        const form = document.getElementById('add-player-form');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }

    async savePlayer() {
        const roblox = document.getElementById('player-roblox').value;
        const discord = document.getElementById('player-discord').value;
        const nickname = document.getElementById('player-nickname').value;

        if (!roblox || !discord || !nickname) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        // Проверка прав
        if (this.currentRole !== 'admin' && this.currentRole !== 'owner') {
            this.showNotification('Недостаточно прав', 'error');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('players')
                .insert([
                    {
                        roblox_username: roblox,
                        discord_username: discord,
                        nickname: nickname,
                        added_by: this.currentUser.id,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (error) throw error;

            this.showNotification('Игрок успешно добавлен', 'success');
            this.toggleAddPlayerForm();
            this.loadPlayers();

            // Очистить форму
            document.getElementById('player-roblox').value = '';
            document.getElementById('player-discord').value = '';
            document.getElementById('player-nickname').value = '';

        } catch (error) {
            this.showNotification('Ошибка: ' + error.message, 'error');
        }
    }

    async loadPlayers() {
        try {
            const { data, error } = await supabase
                .from('players')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.displayPlayers(data);
        } catch (error) {
            console.error('Ошибка загрузки игроков:', error);
        }
    }

    displayPlayers(players) {
        const container = document.getElementById('players-list');
        
        if (!players || players.length === 0) {
            container.innerHTML = '<p>Нет игроков</p>';
            return;
        }

        container.innerHTML = players.map(player => `
            <div class="player-card">
                <div class="player-info">
                    <h4>${player.nickname}</h4>
                    <p><strong>Roblox:</strong> ${player.roblox_username}</p>
                    <p><strong>Discord:</strong> ${player.discord_username}</p>
                    <p class="player-date">Добавлен: ${new Date(player.created_at).toLocaleDateString()}</p>
                </div>
                ${this.currentRole === 'admin' || this.currentRole === 'owner' ? `
                    <button class="control-btn small" onclick="dashboard.deletePlayer('${player.id}')">
                        <span>🗑️</span> Удалить
                    </button>
                ` : ''}
            </div>
        `).join('');
    }

    async deletePlayer(playerId) {
        if (!confirm('Удалить этого игрока?')) return;

        try {
            const { error } = await supabase
                .from('players')
                .delete()
                .eq('id', playerId);

            if (error) throw error;

            this.showNotification('Игрок удален', 'success');
            this.loadPlayers();
        } catch (error) {
            this.showNotification('Ошибка удаления: ' + error.message, 'error');
        }
    }

    async loadUsersForAdmin() {
        if (this.currentRole !== 'owner') return;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, email, role')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.displayUsersForAdmin(data);
            this.displayAdminList(data.filter(user => user.role === 'admin'));
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
        }
    }

    displayUsersForAdmin(users) {
        const select = document.getElementById('user-select');
        
        select.innerHTML = '<option value="">Выберите пользователя</option>' + 
            users.filter(user => user.role === 'user')
                .map(user => `
                    <option value="${user.id}">
                        ${user.username} (${user.email})
                    </option>
                `).join('');
    }

    displayAdminList(admins) {
        const container = document.getElementById('admin-list');
        
        if (!admins || admins.length === 0) {
            container.innerHTML = '<p>Нет администраторов</p>';
            return;
        }

        container.innerHTML = admins.map(admin => `
            <div class="admin-item">
                <div class="admin-info">
                    <h5>${admin.username}</h5>
                    <p>${admin.email}</p>
                </div>
                <button class="control-btn small danger" 
                        onclick="dashboard.removeAdmin('${admin.id}')">
                    <span>🗑️</span> Снять
                </button>
            </div>
        `).join('');
    }

    async makeAdmin() {
        const userId = document.getElementById('user-select').value;
        
        if (!userId) {
            this.showNotification('Выберите пользователя', 'error');
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: 'admin' })
                .eq('id', userId);

            if (error) throw error;

            this.showNotification('Пользователь назначен администратором', 'success');
            this.loadUsersForAdmin();
            
            // Сбросить выбор
            document.getElementById('user-select').value = '';

        } catch (error) {
            this.showNotification('Ошибка: ' + error.message, 'error');
        }
    }

    async removeAdmin(userId) {
        if (!confirm('Снять администратора?')) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: 'user' })
                .eq('id', userId);

            if (error) throw error;

            this.showNotification('Администратор снят', 'success');
            this.loadUsersForAdmin();
        } catch (error) {
            this.showNotification('Ошибка: ' + error.message, 'error');
        }
    }

    async handleLogout() {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    }

    showNotification(message, type = 'info') {
        // Создать или использовать существующее уведомление
        let notification = document.getElementById('notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = `notification notification-${type}`;
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

// Глобальный экземпляр
const dashboard = new DashboardSystem();
