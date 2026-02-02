// scripts/auth.js
console.log('Auth script loaded');

const SUPABASE_URL = 'https://dkyqegxdcerlqnfvodjd.supabase.co';  // ЗАМЕНИТЕ НА ВАШ!
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXFlZ3hkY2VybHFuZnZvZGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTc2NzQsImV4cCI6MjA4NTYzMzY3NH0.n6KO-IQMZboeOMCnJQw6gAs8DdWFDZpevAOWBQrxFWA';  // ЗАМЕНИТЕ НА ВАШ!

let supabase;

try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client created');
} catch (error) {
    console.error('Failed to create Supabase client:', error);
}

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.currentRole = 'user';
        this.isLoginMode = true;
        this.init();
    }

    async init() {
        console.log('AuthSystem initializing...');
        this.setupEventListeners();
        await this.checkSession();
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        const switchBtn = document.getElementById('btn-switch-form');
        if (switchBtn) {
            switchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFormMode();
            });
            console.log('Switch button listener added');
        }

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Login form submitted');
                this.handleLogin();
            });
            console.log('Login form listener added');
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Register form submitted');
                this.handleRegister();
            });
            console.log('Register form listener added');
        }
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
        console.log('Form mode toggled to:', this.isLoginMode ? 'login' : 'register');
    }

    async handleLogin() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        console.log('Login attempt:', { username, password });

        if (!username || !password) {
            this.showError('Заполните все поля');
            return;
        }

        try {
            if (!supabase) {
                throw new Error('Supabase not initialized');
            }

            // Для теста: если введен admin/admin123, пропускаем
            if (username === 'admin' && password === 'admin123') {
                console.log('Test login successful');
                this.showError('✅ Вход выполнен (тестовый режим)', 'success');
                sessionStorage.setItem('user_id', 'test-id');
                sessionStorage.setItem('user_username', 'admin');
                sessionStorage.setItem('user_role', 'admin');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                return;
            }

            // Настоящая аутентификация
            const { data, error } = await supabase.auth.signInWithPassword({
                email: `${username}@bobix.com`,
                password: password
            });

            if (error) {
                console.error('Login error:', error);
                throw error;
            }

            console.log('Login successful:', data);
            this.currentUser = data.user;
            
            // Сохраняем в sessionStorage
            sessionStorage.setItem('user_id', data.user.id);
            sessionStorage.setItem('user_username', username);
            
            this.showError('✅ Вход выполнен успешно!', 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);

        } catch (error) {
            console.error('Login failed:', error);
            this.showError('Неверный логин или пароль');
        }
    }

    async handleRegister() {
        const username = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        console.log('Registration attempt:', { username, email });

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
            if (!supabase) {
                throw new Error('Supabase not initialized');
            }

            // Регистрация
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username
                    }
                }
            });

            if (error) {
                console.error('Registration error:', error);
                throw error;
            }

            console.log('Registration successful:', data);
            
            this.showError('✅ Регистрация успешна! Проверьте email для подтверждения.', 'success');
            
            // Очищаем форму
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm-password').value = '';
            
            // Переключаем на форму входа
            setTimeout(() => {
                this.toggleFormMode();
            }, 2000);

        } catch (error) {
            console.error('Registration failed:', error);
            this.showError('Ошибка регистрации: ' + error.message);
        }
    }

    async checkSession() {
        try {
            if (!supabase) return;
            
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                console.log('Session found:', session);
                this.currentUser = session.user;
                
                // Если уже авторизован, перенаправляем
                if (window.location.pathname.includes('index.html')) {
                    window.location.href = 'dashboard.html';
                }
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    showError(message, type = 'error') {
        const errorElement = document.getElementById('auth-error');
        if (!errorElement) {
            console.error('Error element not found');
            return;
        }
        
        errorElement.textContent = message;
        errorElement.className = `auth-error ${type}`;
        errorElement.style.display = 'block';
        
        console.log(`Error shown (${type}):`, message);
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AuthSystem...');
    window.authSystem = new AuthSystem();
});
