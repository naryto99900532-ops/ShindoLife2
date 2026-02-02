// scripts/auth.js
console.log('=== Auth Script Loading ===');

// Конфигурация Supabase - ЗАМЕНИТЕ!
const SUPABASE_URL = 'https://dkyqegxdcerlqnfvodjd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXFlZ3hkY2VybHFuZnZvZGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTc2NzQsImV4cCI6MjA4NTYzMzY3NH0.n6KO-IQMZboeOMCnJQw6gAs8DdWFDZpevAOWBQrxFWA';

// Глобальная переменная для Supabase клиента
let supabaseClient = null;

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.currentRole = 'user';
        this.isLoginMode = true;
        this.supabase = null;
        this.init();
    }

    async init() {
        console.log('Initializing AuthSystem...');
        
        // Инициализируем Supabase
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!this.supabase) {
            this.showError('Ошибка подключения к базе данных', 'error');
            return;
        }
        
        console.log('Supabase client created');
        this.setupEventListeners();
        await this.checkSession();
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Переключение форм
        document.getElementById('btn-switch-form').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleFormMode();
        });

        // Форма входа
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Форма регистрации
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
    }

    async handleRegister() {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        console.log('Registration attempt:', { username, email });

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

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('Введите корректный email');
            return;
        }

        try {
            console.log('Starting registration...');
            
            // 1. Регистрация в Supabase Auth с метаданными
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username,
                        display_name: username
                    }
                }
            });

            if (authError) {
                console.error('Auth error:', authError);
                
                if (authError.message.includes('already registered')) {
                    this.showError('Пользователь с таким email уже существует', 'error');
                    return;
                }
                
                throw authError;
            }

            console.log('Auth registration success:', authData);

            if (authData.user) {
                // 2. Ручное создание профиля в таблице profiles
                await this.createUserProfile(authData.user.id, username, email);
                
                this.showError('✅ Регистрация успешна! Проверьте email для подтверждения.', 'success');
                
                // Очищаем форму
                document.getElementById('reg-username').value = '';
                document.getElementById('reg-email').value = '';
                document.getElementById('reg-password').value = '';
                document.getElementById('reg-confirm-password').value = '';
                
                // Переключаем на форму входа
                setTimeout(() => {
                    this.toggleFormMode();
                }, 3000);
            } else {
                this.showError('Не удалось создать пользователя', 'error');
            }

        } catch (error) {
            console.error('Registration failed:', error);
            this.showError('Ошибка регистрации: ' + error.message);
        }
    }

    async createUserProfile(userId, username, email) {
        try {
            console.log('Creating profile for user:', userId);
            
            // Пробуем вставить профиль
            const { error } = await this.supabase
                .from('profiles')
                .insert([
                    {
                        id: userId,
                        username: username,
                        email: email,
                        role: 'user'
                    }
                ]);

            if (error) {
                console.error('Profile creation error:', error);
                
                // Если таблицы нет, создаем ее
                if (error.message.includes('relation "profiles" does not exist')) {
                    console.log('Profiles table does not exist');
                    await this.createProfilesTable();
                    // Пробуем снова
                    await this.supabase.from('profiles').insert([
                        { id: userId, username: username, email: email, role: 'user' }
                    ]);
                } else {
                    throw error;
                }
            }
            
            console.log('Profile created successfully');
            
        } catch (error) {
            console.error('Failed to create profile:', error);
            throw error;
        }
    }

    async createProfilesTable() {
        console.log('Attempting to create profiles table...');
        
        // Это нельзя сделать через клиент, нужно делать через SQL Editor
        // Просто показываем сообщение
        this.showError('⚠️ Таблица пользователей не настроена. Обратитесь к администратору.', 'warning');
        
        throw new Error('Profiles table does not exist');
    }

    async handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        console.log('Login attempt:', username);

        if (!username || !password) {
            this.showError('Заполните все поля');
            return;
        }

        try {
            // Тестовый аккаунт
            if (username === 'admin' && password === 'admin123') {
                this.showError('✅ Вход выполнен (тестовый режим)', 'success');
                sessionStorage.setItem('user_id', 'test-admin-id');
                sessionStorage.setItem('user_username', 'admin');
                sessionStorage.setItem('user_role', 'admin');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                return;
            }

            // Пробуем найти пользователя по username в profiles
            console.log('Looking for user in profiles...');
            const { data: profile, error: profileError } = await this.supabase
                .from('profiles')
                .select('email')
                .eq('username', username)
                .single();

            if (profileError || !profile) {
                // Если не нашли по username, пробуем как email
                console.log('User not found by username, trying as email...');
                const email = username.includes('@') ? username : `${username}@bobix.com`;
                
                const { data, error } = await this.supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) throw error;
                
                this.handleSuccessfulLogin(data.user, username);
                return;
            }

            // Нашли профиль, входим с email из профиля
            console.log('Found profile, logging in with email:', profile.email);
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: profile.email,
                password: password
            });

            if (error) throw error;
            
            this.handleSuccessfulLogin(data.user, username);

        } catch (error) {
            console.error('Login error:', error);
            this.showError('Неверный логин или пароль');
        }
    }

    handleSuccessfulLogin(user, username) {
        console.log('Login successful:', user.id);
        
        sessionStorage.setItem('user_id', user.id);
        sessionStorage.setItem('user_username', username);
        sessionStorage.setItem('user_email', user.email);
        
        this.showError('✅ Вход выполнен успешно!', 'success');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
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

    async checkSession() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                console.log('Found session:', session.user.email);
                
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
        if (!errorElement) return;
        
        errorElement.textContent = message;
        errorElement.className = `auth-error ${type}`;
        errorElement.style.display = 'block';
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting AuthSystem...');
    window.authSystem = new AuthSystem();
});
