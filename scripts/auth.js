// scripts/auth.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
console.log('=== BOBIX EMPIRE Auth System ===');

const SUPABASE_URL = 'https://dkyqegxdcerlqnfvodjd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXFlZ3hkY2VybHFuZnZvZGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTc2NzQsImV4cCI6MjA4NTYzMzY3NH0.n6KO-IQMZboeOMCnJQw6gAs8DdWFDZpevAOWBQrxFWA';

class AuthSystem {
    constructor() {
        this.supabase = null;
        this.isLoginMode = true;
        this.isProcessing = false; // Флаг для предотвращения повторных запросов
        this.init();
    }

    async init() {
        console.log('Initializing AuthSystem...');
        
        try {
            this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized');
            
            this.setupEventListeners();
            await this.checkSession();
            
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Ошибка инициализации системы', 'error');
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        const switchBtn = document.getElementById('btn-switch-form');
        if (switchBtn) {
            switchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFormMode();
            });
        }

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
    }

    toggleFormMode() {
        if (this.isProcessing) return; // Не переключать если идет обработка
        
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
        // Защита от повторного нажатия
        if (this.isProcessing) {
            console.log('Login already in progress, skipping...');
            return;
        }
        
        this.isProcessing = true;
        
        // Отключаем кнопку
        const loginBtn = document.getElementById('btn-login');
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span>⏳</span> Вход...';
        loginBtn.disabled = true;

        const identifier = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        console.log('Login attempt for:', identifier);

        if (!identifier || !password) {
            this.showError('Заполните все поля', 'error');
            this.resetLoginButton(loginBtn, originalText);
            this.isProcessing = false;
            return;
        }

        try {
            this.showError('Проверка данных...', 'info');

            // Определяем email для входа
            let email = identifier;
            
            // Если введен не email, ищем username в profiles
            if (!identifier.includes('@')) {
                console.log('Searching for username:', identifier);
                const { data: profile, error: profileError } = await this.supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', identifier)
                    .maybeSingle(); // Используем maybeSingle вместо single
                
                if (profileError) {
                    console.error('Profile search error:', profileError);
                }
                
                if (profile && profile.email) {
                    email = profile.email;
                    console.log('Found email in profiles:', email);
                } else {
                    // Если не нашли, пробуем с @bobix.com
                    email = identifier + '@bobix.com';
                    console.log('Using generated email:', email);
                }
            }

            // Пробуем войти
            console.log('Attempting login with email:', email);
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('Login error:', error.message);
                
                // Пробуем тестовый аккаунт
                if (await this.tryTestAccount(identifier, password)) {
                    this.resetLoginButton(loginBtn, originalText);
                    this.isProcessing = false;
                    return;
                }
                
                // Очищаем пароль при ошибке
                document.getElementById('login-password').value = '';
                
                // Показываем понятную ошибку
                if (error.message.includes('Invalid login credentials')) {
                    this.showError('Неверный логин или пароль', 'error');
                } else if (error.message.includes('Email not confirmed')) {
                    this.showError('Подтвердите email перед входом', 'error');
                } else {
                    this.showError('Ошибка входа: ' + error.message, 'error');
                }
                
                this.resetLoginButton(loginBtn, originalText);
                this.isProcessing = false;
                return;
            }

            // Успешный вход
            await this.handleSuccessfulLogin(data.user, identifier);
            
        } catch (error) {
            console.error('Login exception:', error);
            this.showError('Ошибка подключения к серверу', 'error');
            this.resetLoginButton(loginBtn, originalText);
            this.isProcessing = false;
        }
    }

    resetLoginButton(button, originalText) {
        button.innerHTML = originalText;
        button.disabled = false;
    }

    async tryTestAccount(identifier, password) {
        // Тестовые аккаунты (безопасные)
        const testAccounts = {
            'admin': { email: 'admin@bobix.com', password: 'admin123', role: 'admin' },
            'test': { email: 'test@bobix.com', password: 'test123', role: 'user' },
            'user': { email: 'user@bobix.com', password: 'user123', role: 'user' }
        };

        const account = testAccounts[identifier];
        
        if (account && password === account.password) {
            console.log('Using test account:', identifier);
            
            // Сохраняем тестовые данные
            sessionStorage.setItem('user_id', 'test-' + Date.now());
            sessionStorage.setItem('user_username', identifier);
            sessionStorage.setItem('user_email', account.email);
            sessionStorage.setItem('user_role', account.role);
            sessionStorage.setItem('is_test_account', 'true');
            
            this.showError('✅ Вход выполнен (тестовый режим)', 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
            return true;
        }
        
        return false;
    }

    async handleSuccessfulLogin(user, identifier) {
        console.log('Login successful for user:', user.id);
        
        // Сохраняем реальные данные
        sessionStorage.setItem('user_id', user.id);
        sessionStorage.setItem('user_email', user.email);
        sessionStorage.removeItem('is_test_account');
        
        // Получаем дополнительные данные из profiles
        try {
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('username, role')
                .eq('id', user.id)
                .maybeSingle();
            
            if (profile) {
                sessionStorage.setItem('user_username', profile.username || identifier);
                sessionStorage.setItem('user_role', profile.role || 'user');
            } else {
                sessionStorage.setItem('user_username', identifier);
                sessionStorage.setItem('user_role', 'user');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            sessionStorage.setItem('user_username', identifier);
            sessionStorage.setItem('user_role', 'user');
        }
        
        this.showError('✅ Вход выполнен успешно!', 'success');
        
        // Перенаправляем через секунду
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    }

    async handleRegister() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        const registerBtn = document.getElementById('btn-register');
        const originalText = registerBtn.innerHTML;
        registerBtn.innerHTML = '<span>⏳</span> Регистрация...';
        registerBtn.disabled = true;

        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        // Валидация
        if (!username || !email || !password || !confirmPassword) {
            this.showError('Заполните все поля', 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Пароли не совпадают', 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
            return;
        }

        if (password.length < 6) {
            this.showError('Пароль должен быть не менее 6 символов', 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('Введите корректный email', 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
            return;
        }

        try {
            this.showError('Регистрация...', 'info');

            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { username: username }
                }
            });

            if (authError) {
                console.error('Registration error:', authError);
                
                if (authError.message.includes('already registered')) {
                    this.showError('Пользователь с таким email уже существует', 'error');
                } else {
                    this.showError('Ошибка регистрации: ' + authError.message, 'error');
                }
                
                this.resetRegisterButton(registerBtn, originalText);
                this.isProcessing = false;
                return;
            }

            console.log('Registration successful:', authData);

            // Создаем профиль если пользователь создан
            if (authData.user) {
                await this.createUserProfile(authData.user.id, username, email);
            }

            this.showError('✅ Регистрация успешна! Теперь войдите.', 'success');
            
            // Очищаем форму
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm-password').value = '';
            
            // Переключаем на вход через 2 секунды
            setTimeout(() => {
                this.toggleFormMode();
                this.resetRegisterButton(registerBtn, originalText);
                this.isProcessing = false;
            }, 2000);

        } catch (error) {
            console.error('Registration exception:', error);
            this.showError('Ошибка сервера: ' + error.message, 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
        }
    }

    resetRegisterButton(button, originalText) {
        button.innerHTML = originalText;
        button.disabled = false;
    }

    async createUserProfile(userId, username, email) {
        try {
            console.log('Creating profile for:', userId);
            
            const { error } = await this.supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    username: username,
                    email: email,
                    role: 'user',
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'id'
                });

            if (error) {
                console.error('Profile creation error:', error);
                // Игнорируем если таблицы нет
                if (!error.message.includes('does not exist')) {
                    throw error;
                }
            }
            
        } catch (error) {
            console.error('Failed to create profile:', error);
        }
    }

    async checkSession() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                console.log('Active session found:', session.user.email);
                
                // Если на странице входа, перенаправляем
                if (window.location.pathname.includes('index.html') || 
                    window.location.pathname === '/') {
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
        
        // Автоскрытие для информационных сообщений
        if (type === 'info') {
            setTimeout(() => {
                if (errorElement.textContent === message) {
                    errorElement.style.display = 'none';
                }
            }, 3000);
        }
    }
}

// Запуск системы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting AuthSystem...');
    window.authSystem = new AuthSystem();
});// scripts/auth.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
console.log('=== BOBIX EMPIRE Auth System ===');

const SUPABASE_URL = 'https://dkyqegxdcerlqnfvodjd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXFlZ3hkY2VybHFuZnZvZGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTc2NzQsImV4cCI6MjA4NTYzMzY3NH0.n6KO-IQMZboeOMCnJQw6gAs8DdWFDZpevAOWBQrxFWA';

class AuthSystem {
    constructor() {
        this.supabase = null;
        this.isLoginMode = true;
        this.isProcessing = false; // Флаг для предотвращения повторных запросов
        this.init();
    }

    async init() {
        console.log('Initializing AuthSystem...');
        
        try {
            this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized');
            
            this.setupEventListeners();
            await this.checkSession();
            
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Ошибка инициализации системы', 'error');
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        const switchBtn = document.getElementById('btn-switch-form');
        if (switchBtn) {
            switchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFormMode();
            });
        }

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
    }

    toggleFormMode() {
        if (this.isProcessing) return; // Не переключать если идет обработка
        
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
        // Защита от повторного нажатия
        if (this.isProcessing) {
            console.log('Login already in progress, skipping...');
            return;
        }
        
        this.isProcessing = true;
        
        // Отключаем кнопку
        const loginBtn = document.getElementById('btn-login');
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span>⏳</span> Вход...';
        loginBtn.disabled = true;

        const identifier = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        console.log('Login attempt for:', identifier);

        if (!identifier || !password) {
            this.showError('Заполните все поля', 'error');
            this.resetLoginButton(loginBtn, originalText);
            this.isProcessing = false;
            return;
        }

        try {
            this.showError('Проверка данных...', 'info');

            // Определяем email для входа
            let email = identifier;
            
            // Если введен не email, ищем username в profiles
            if (!identifier.includes('@')) {
                console.log('Searching for username:', identifier);
                const { data: profile, error: profileError } = await this.supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', identifier)
                    .maybeSingle(); // Используем maybeSingle вместо single
                
                if (profileError) {
                    console.error('Profile search error:', profileError);
                }
                
                if (profile && profile.email) {
                    email = profile.email;
                    console.log('Found email in profiles:', email);
                } else {
                    // Если не нашли, пробуем с @bobix.com
                    email = identifier + '@bobix.com';
                    console.log('Using generated email:', email);
                }
            }

            // Пробуем войти
            console.log('Attempting login with email:', email);
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('Login error:', error.message);
                
                // Пробуем тестовый аккаунт
                if (await this.tryTestAccount(identifier, password)) {
                    this.resetLoginButton(loginBtn, originalText);
                    this.isProcessing = false;
                    return;
                }
                
                // Очищаем пароль при ошибке
                document.getElementById('login-password').value = '';
                
                // Показываем понятную ошибку
                if (error.message.includes('Invalid login credentials')) {
                    this.showError('Неверный логин или пароль', 'error');
                } else if (error.message.includes('Email not confirmed')) {
                    this.showError('Подтвердите email перед входом', 'error');
                } else {
                    this.showError('Ошибка входа: ' + error.message, 'error');
                }
                
                this.resetLoginButton(loginBtn, originalText);
                this.isProcessing = false;
                return;
            }

            // Успешный вход
            await this.handleSuccessfulLogin(data.user, identifier);
            
        } catch (error) {
            console.error('Login exception:', error);
            this.showError('Ошибка подключения к серверу', 'error');
            this.resetLoginButton(loginBtn, originalText);
            this.isProcessing = false;
        }
    }

    resetLoginButton(button, originalText) {
        button.innerHTML = originalText;
        button.disabled = false;
    }

    async tryTestAccount(identifier, password) {
        // Тестовые аккаунты (безопасные)
        const testAccounts = {
            'admin': { email: 'admin@bobix.com', password: 'admin123', role: 'admin' },
            'test': { email: 'test@bobix.com', password: 'test123', role: 'user' },
            'user': { email: 'user@bobix.com', password: 'user123', role: 'user' }
        };

        const account = testAccounts[identifier];
        
        if (account && password === account.password) {
            console.log('Using test account:', identifier);
            
            // Сохраняем тестовые данные
            sessionStorage.setItem('user_id', 'test-' + Date.now());
            sessionStorage.setItem('user_username', identifier);
            sessionStorage.setItem('user_email', account.email);
            sessionStorage.setItem('user_role', account.role);
            sessionStorage.setItem('is_test_account', 'true');
            
            this.showError('✅ Вход выполнен (тестовый режим)', 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
            return true;
        }
        
        return false;
    }

    async handleSuccessfulLogin(user, identifier) {
        console.log('Login successful for user:', user.id);
        
        // Сохраняем реальные данные
        sessionStorage.setItem('user_id', user.id);
        sessionStorage.setItem('user_email', user.email);
        sessionStorage.removeItem('is_test_account');
        
        // Получаем дополнительные данные из profiles
        try {
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('username, role')
                .eq('id', user.id)
                .maybeSingle();
            
            if (profile) {
                sessionStorage.setItem('user_username', profile.username || identifier);
                sessionStorage.setItem('user_role', profile.role || 'user');
            } else {
                sessionStorage.setItem('user_username', identifier);
                sessionStorage.setItem('user_role', 'user');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            sessionStorage.setItem('user_username', identifier);
            sessionStorage.setItem('user_role', 'user');
        }
        
        this.showError('✅ Вход выполнен успешно!', 'success');
        
        // Перенаправляем через секунду
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    }

    async handleRegister() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        const registerBtn = document.getElementById('btn-register');
        const originalText = registerBtn.innerHTML;
        registerBtn.innerHTML = '<span>⏳</span> Регистрация...';
        registerBtn.disabled = true;

        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        // Валидация
        if (!username || !email || !password || !confirmPassword) {
            this.showError('Заполните все поля', 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Пароли не совпадают', 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
            return;
        }

        if (password.length < 6) {
            this.showError('Пароль должен быть не менее 6 символов', 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('Введите корректный email', 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
            return;
        }

        try {
            this.showError('Регистрация...', 'info');

            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { username: username }
                }
            });

            if (authError) {
                console.error('Registration error:', authError);
                
                if (authError.message.includes('already registered')) {
                    this.showError('Пользователь с таким email уже существует', 'error');
                } else {
                    this.showError('Ошибка регистрации: ' + authError.message, 'error');
                }
                
                this.resetRegisterButton(registerBtn, originalText);
                this.isProcessing = false;
                return;
            }

            console.log('Registration successful:', authData);

            // Создаем профиль если пользователь создан
            if (authData.user) {
                await this.createUserProfile(authData.user.id, username, email);
            }

            this.showError('✅ Регистрация успешна! Теперь войдите.', 'success');
            
            // Очищаем форму
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm-password').value = '';
            
            // Переключаем на вход через 2 секунды
            setTimeout(() => {
                this.toggleFormMode();
                this.resetRegisterButton(registerBtn, originalText);
                this.isProcessing = false;
            }, 2000);

        } catch (error) {
            console.error('Registration exception:', error);
            this.showError('Ошибка сервера: ' + error.message, 'error');
            this.resetRegisterButton(registerBtn, originalText);
            this.isProcessing = false;
        }
    }

    resetRegisterButton(button, originalText) {
        button.innerHTML = originalText;
        button.disabled = false;
    }

    async createUserProfile(userId, username, email) {
        try {
            console.log('Creating profile for:', userId);
            
            const { error } = await this.supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    username: username,
                    email: email,
                    role: 'user',
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'id'
                });

            if (error) {
                console.error('Profile creation error:', error);
                // Игнорируем если таблицы нет
                if (!error.message.includes('does not exist')) {
                    throw error;
                }
            }
            
        } catch (error) {
            console.error('Failed to create profile:', error);
        }
    }

    async checkSession() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                console.log('Active session found:', session.user.email);
                
                // Если на странице входа, перенаправляем
                if (window.location.pathname.includes('index.html') || 
                    window.location.pathname === '/') {
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
        
        // Автоскрытие для информационных сообщений
        if (type === 'info') {
            setTimeout(() => {
                if (errorElement.textContent === message) {
                    errorElement.style.display = 'none';
                }
            }, 3000);
        }
    }
}

// Запуск системы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting AuthSystem...');
    window.authSystem = new AuthSystem();
});
