// Конфигурация Supabase
const SUPABASE_URL = 'https://dkyqegxdcerlqnfvodjd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXFlZ3hkY2VybHFuZnZvZGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTc2NzQsImV4cCI6MjA4NTYzMzY3NH0.n6KO-IQMZboeOMCnJQw6gAs8DdWFDZpevAOWBQrxFWA';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.currentRole = 'user';
        this.isLoginMode = true;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkSession();
    }

    setupEventListeners() {
        // Переключение форм
        document.getElementById('btn-switch-form').addEventListener('click', () => {
            this.toggleFormMode();
        });

        // Отправка формы входа
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Отправка формы регистрации
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
    }

    toggleFormMode() {
        this.isLoginMode = !this.isLoginMode;
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const switchText = document.getElementById('switch-text');
        const switchBtn = document.getElementById('btn-switch-form');

        if (this.isLoginMode) {
            loginForm.style.display = 'flex';
            registerForm.style.display = 'none';
            switchText.textContent = 'Нет аккаунта?';
            switchBtn.textContent = 'Зарегистрироваться';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'flex';
            switchText.textContent = 'Уже есть аккаунт?';
            switchBtn.textContent = 'Войти';
        }

        this.showError('');
    }

    async handleLogin() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            this.showError('Заполните все поля');
            return;
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: `${username}@bobix.com`,
                password: password
            });

            if (error) throw error;

            this.currentUser = data.user;
            await this.getUserRole(data.user.id);
            this.redirectToDashboard();

        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleRegister() {
        const username = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        // Валидация
        if (!username || !email || !password || !confirmPassword) {
            this.showError('Заполните все поля');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Пароли не совпадают');
            return;
        }

        if (password.length < 6) {
            this.showError('Пароль должен быть не менее 6 символов');
            return;
        }

        try {
            // Регистрация в Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username
                    }
                }
            });

            if (error) throw error;

            // Создание профиля пользователя
            await this.createUserProfile(data.user.id, username, email);
            
            this.showError('✅ Регистрация успешна! Теперь войдите.', 'success');
            
            // Переключение на форму входа
            setTimeout(() => {
                this.toggleFormMode();
            }, 2000);

        } catch (error) {
            this.showError(error.message);
        }
    }

    async createUserProfile(userId, username, email) {
        const { error } = await supabase
            .from('profiles')
            .insert([
                {
                    id: userId,
                    username: username,
                    email: email,
                    role: 'user',
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Ошибка создания профиля:', error);
            throw error;
        }
    }

    async getUserRole(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!error && data) {
            this.currentRole = data.role;
            sessionStorage.setItem('user_role', data.role);
        }
    }

    async checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            this.currentUser = session.user;
            await this.getUserRole(session.user.id);
            this.redirectToDashboard();
        }
    }

    redirectToDashboard() {
        sessionStorage.setItem('user_id', this.currentUser.id);
        window.location.href = 'dashboard.html';
    }

    showError(message, type = 'error') {
        const errorElement = document.getElementById('auth-error');
        errorElement.textContent = message;
        errorElement.className = `auth-error ${type}`;
        errorElement.style.display = message ? 'block' : 'none';
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    new AuthSystem();
});
