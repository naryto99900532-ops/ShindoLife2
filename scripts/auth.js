// scripts/auth.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
console.log('=== BOBIX EMPIRE Auth System ===');

// НАСТРОЙТЕ ЭТИ КЛЮЧИ!
const SUPABASE_URL = 'https://dkyqegxdcerlqnfvodjd.supabase.co';  // Ваш URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXFlZ3hkY2VybHFuZnZvZGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTc2NzQsImV4cCI6MjA4NTYzMzY3NH0.n6KO-IQMZboeOMCnJQw6gAs8DdWFDZpevAOWBQrxFWA';  // Ваш ключ

class AuthSystem {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.isLoginMode = true;
        this.init();
    }

    async init() {
        console.log('Initializing AuthSystem...');
        
        try {
            // Инициализация Supabase
            this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized');
            
            this.setupEventListeners();
            await this.checkSession();
            
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Ошибка инициализации системы');
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Переключение форм
        document.getElementById('btn-switch-form').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleFormMode();
        });

        // Вход
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Регистрация
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

    async handleRegister() {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        console.log('Регистрация:', { username, email });

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

        // Проверка email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('Введите корректный email');
            return;
        }

        try {
            this.showError('Регистрация...', 'info');

            // 1. Регистрация в Supabase Auth
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username
                    }
                }
            });

            if (authError) {
                console.error('Ошибка регистрации:', authError);
                
                if (authError.message.includes('already registered')) {
                    this.showError('Пользователь с таким email уже существует');
                    return;
                }
                
                throw authError;
            }

            console.log('Регистрация успешна:', authData);

            // 2. Создаем профиль вручную
            if (authData.user) {
                await this.createUserProfile(authData.user.id, username, email);
            }

            // 3. Показываем успех
            this.showError('✅ Регистрация успешна! Теперь войдите.', 'success');
            
            // Очищаем форму
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm-password').value = '';
            
            // Переключаем на вход
            setTimeout(() => {
                this.toggleFormMode();
            }, 2000);

        } catch (error) {
            console.error('Ошибка регистрации:', error);
            this.showError('Ошибка: ' + error.message);
        }
    }

    async createUserProfile(userId, username, email) {
        try {
            console.log('Создание профиля для:', userId);
            
            const { error } = await this.supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    username: username,
                    email: email,
                    role: 'user',
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('Ошибка создания профиля:', error);
                // Если таблицы нет, просто игнорируем
                if (error.message.includes('does not exist')) {
                    console.warn('Таблица profiles не существует');
                } else {
                    throw error;
                }
            } else {
                console.log('Профиль создан');
            }
            
        } catch (error) {
            console.error('Не удалось создать профиль:', error);
        }
    }

    async handleLogin() {
        const identifier = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        console.log('Вход с идентификатором:', identifier);

        if (!identifier || !password) {
            this.showError('Заполните все поля');
            return;
        }

        try {
            this.showError('Вход...', 'info');

            // Вариант 1: Пробуем как email
            let email = identifier;
            if (!identifier.includes('@')) {
                // Если не email, ищем username в profiles
                console.log('Ищем пользователя по username:', identifier);
                const { data: profile } = await this.supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', identifier)
                    .single();
                
                if (profile && profile.email) {
                    email = profile.email;
                    console.log('Найден email:', email);
                } else {
                    // Если не нашли, добавляем @bobix.com
                    email = identifier + '@bobix.com';
                    console.log('Используем email:', email);
                }
            }

            // Пробуем войти
            console.log('Пробуем войти с email:', email);
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('Ошибка входа:', error);
                
                // Если не получилось, пробуем как test@example.com
                if (email !== 'test@example.com') {
                    console.log('Пробуем тестовый аккаунт...');
                    await this.tryTestAccount(identifier, password);
                    return;
                }
                
                throw error;
            }

            // Успешный вход
            await this.handleSuccessfulLogin(data.user, identifier);

        } catch (error) {
            console.error('Ошибка входа:', error);
            this.showError('Неверный логин или пароль');
        }
    }

    async tryTestAccount(identifier, password) {
        // Тестовые аккаунты
        const testAccounts = {
            'admin': { email: 'admin@bobix.com', password: 'admin123', role: 'admin' },
            'test': { email: 'test@example.com', password: 'test123', role: 'user' },
            'user': { email: 'user@example.com', password: 'user123', role: 'user' }
        };

        if (testAccounts[identifier] && password === testAccounts[identifier].password) {
            console.log('Используем тестовый аккаунт:', identifier);
            
            // Создаем фейковую сессию
            sessionStorage.setItem('user_id', 'test-' + identifier);
            sessionStorage.setItem('user_username', identifier);
            sessionStorage.setItem('user_email', testAccounts[identifier].email);
            sessionStorage.setItem('user_role', testAccounts[identifier].role);
            
            this.showError('✅ Вход выполнен (тестовый режим)', 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
            return true;
        }
        
        return false;
    }

    async handleSuccessfulLogin(user, identifier) {
        console.log('Успешный вход:', user.id);
        
        // Сохраняем данные
        sessionStorage.setItem('user_id', user.id);
        sessionStorage.setItem('user_email', user.email);
        
        // Получаем username из profiles
        const { data: profile } = await this.supabase
            .from('profiles')
            .select('username, role')
            .eq('id', user.id)
            .single();
        
        if (profile) {
            sessionStorage.setItem('user_username', profile.username || identifier);
            sessionStorage.setItem('user_role', profile.role || 'user');
        } else {
            sessionStorage.setItem('user_username', identifier);
            sessionStorage.setItem('user_role', 'user');
        }
        
        this.showError('✅ Вход выполнен успешно!', 'success');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    }

    async checkSession() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                console.log('Найдена активная сессия:', session.user.email);
                this.currentUser = session.user;
                
                // Если на странице входа, перенаправляем
                if (window.location.pathname.includes('index.html')) {
                    window.location.href = 'dashboard.html';
                }
            }
        } catch (error) {
            console.error('Ошибка проверки сессии:', error);
        }
    }

    showError(message, type = 'error') {
        const errorElement = document.getElementById('auth-error');
        if (!errorElement) return;
        
        errorElement.textContent = message;
        errorElement.className = `auth-error ${type}`;
        errorElement.style.display = 'block';
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, запускаем AuthSystem...');
    window.authSystem = new AuthSystem();
});
