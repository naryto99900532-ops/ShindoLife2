// scripts/auth.js
console.log('=== Auth Script Loading ===');

// Конфигурация Supabase - ЗАМЕНИТЕ НА ВАШИ КЛЮЧИ!
const SUPABASE_URL = 'https://dkyqegxdcerlqnfvodjd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXFlZ3hkY2VybHFuZnZvZGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTc2NzQsImV4cCI6MjA4NTYzMzY3NH0.n6KO-IQMZboeOMCnJQw6gAs8DdWFDZpevAOWBQrxFWA';

// Глобальная переменная для Supabase клиента
let supabaseClient = null;

// Инициализация Supabase
function initSupabase() {
    if (!window.supabase) {
        console.error('Supabase SDK not loaded!');
        return null;
    }
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
        return supabaseClient;
    } catch (error) {
        console.error('Failed to create Supabase client:', error);
        return null;
    }
}

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
        this.supabase = initSupabase();
        if (!this.supabase) {
            this.showError('Ошибка подключения к базе данных', 'error');
            return;
        }
        
        this.setupEventListeners();
        await this.checkSession();
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Переключение форм
        const switchBtn = document.getElementById('btn-switch-form');
        if (switchBtn) {
            switchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFormMode();
            });
            console.log('Switch button listener added');
        }

        // Форма входа
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Login form submitted');
                this.handleLogin();
            });
        }

        // Форма регистрации
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Register form submitted');
                this.handleRegister();
            });
        }
        
        console.log('All event listeners added');
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
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        console.log('Login attempt for username:', username);

        if (!username || !password) {
            this.showError('Заполните все поля');
            return;
        }

        try {
            // Тестовый аккаунт для проверки
            if (username === 'admin' && password === 'admin123') {
                console.log('Using test account');
                this.showError('✅ Вход выполнен (тестовый режим)', 'success');
                sessionStorage.setItem('user_id', 'test-admin-id');
                sessionStorage.setItem('user_username', 'admin');
                sessionStorage.setItem('user_role', 'admin');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                return;
            }

            // Реальная аутентификация через Supabase
            console.log('Attempting Supabase authentication...');
            
            // Вариант 1: Используем email как username@bobix.com
            const email = `${username}@bobix.com`;
            console.log('Using email for login:', email);
            
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('Supabase login error:', error);
                
                // Пробуем найти пользователя по username в таблице profiles
                console.log('Trying to find user by username...');
                const { data: profile } = await this.supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', username)
                    .single();
                    
                if (profile && profile.email) {
                    console.log('Found user email:', profile.email);
                    // Пробуем войти с найденным email
                    const { data: data2, error: error2 } = await this.supabase.auth.signInWithPassword({
                        email: profile.email,
                        password: password
                    });
                    
                    if (error2) throw error2;
                    
                    this.handleSuccessfulLogin(data2.user, username);
                    return;
                }
                
                throw error;
            }

            // Успешный вход
            this.handleSuccessfulLogin(data.user, username);

        } catch (error) {
            console.error('Login failed:', error);
            this.showError('Неверный логин или пароль');
        }
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

        // Проверяем email формат
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('Введите корректный email');
            return;
        }

        try {
            console.log('Starting registration process...');
            
            // 1. Регистрация в Supabase Auth
            console.log('Creating Supabase auth user...');
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
                console.error('Auth registration error:', authError);
                
                // Если пользователь уже существует, пробуем войти
                if (authError.message.includes('already registered')) {
                    this.showError('Пользователь с таким email уже существует. Попробуйте войти.', 'error');
                    this.toggleFormMode();
                    return;
                }
                
                throw authError;
            }

            console.log('Auth registration successful:', authData);

            // 2. Ждем немного и создаем профиль
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 3. Получаем ID пользователя
            const userId = authData.user?.id;
            if (!userId) {
                throw new Error('Не удалось получить ID пользователя');
            }

            console.log('User ID:', userId);

            // 4. Создаем запись в таблице profiles
            console.log('Creating profile in database...');
            const { error: profileError } = await this.supabase
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

            if (profileError) {
                console.error('Profile creation error:', profileError);
                
                // Если профиль уже существует (дубликат)
                if (profileError.code === '23505') {
                    this.showError('Пользователь с таким именем или email уже существует', 'error');
                    return;
                }
                
                // Если таблицы нет или другая ошибка
                if (profileError.message.includes('relation "profiles" does not exist')) {
                    console.warn('Table "profiles" does not exist. Creating it...');
                    this.showError('⚠️ Таблица пользователей не создана. Обратитесь к администратору.', 'warning');
                    return;
                }
                
                throw profileError;
            }

            console.log('Profile created successfully');
            
            // 5. Показываем успешное сообщение
            this.showError('✅ Регистрация успешна! Теперь войдите в систему.', 'success');
            
            // 6. Очищаем форму
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm-password').value = '';
            
            // 7. Переключаем на форму входа через 3 секунды
            setTimeout(() => {
                this.toggleFormMode();
            }, 3000);

        } catch (error) {
            console.error('Registration failed:', error);
            this.showError('Ошибка регистрации: ' + error.message);
        }
    }

    handleSuccessfulLogin(user, username) {
        console.log('Login successful for user:', user.id);
        
        // Сохраняем данные
        sessionStorage.setItem('user_id', user.id);
        sessionStorage.setItem('user_username', username);
        sessionStorage.setItem('user_email', user.email);
        
        this.showError('✅ Вход выполнен успешно!', 'success');
        
        // Перенаправляем через 1 секунду
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    }

    async checkSession() {
        try {
            if (!this.supabase) return;
            
            console.log('Checking existing session...');
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                console.log('Found active session:', session.user.email);
                this.currentUser = session.user;
                
                // Если уже авторизован и на странице входа, перенаправляем
                if (window.location.pathname.includes('index.html') || 
                    window.location.pathname === '/') {
                    window.location.href = 'dashboard.html';
                }
            } else {
                console.log('No active session found');
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
        
        console.log(`Displaying ${type} message:`, message);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM Content Loaded ===');
    
    // Создаем экземпляр AuthSystem
    try {
        window.authSystem = new AuthSystem();
        console.log('AuthSystem initialized successfully');
    } catch (error) {
        console.error('Failed to initialize AuthSystem:', error);
        
        // Fallback для кнопки переключения форм
        const switchBtn = document.getElementById('btn-switch-form');
        if (switchBtn) {
            switchBtn.onclick = function() {
                const loginForm = document.getElementById('login-form');
                const registerForm = document.getElementById('register-form');
                const switchText = document.getElementById('switch-text');
                
                if (loginForm.style.display !== 'none') {
                    loginForm.style.display = 'none';
                    registerForm.style.display = 'flex';
                    switchText.textContent = 'Уже есть аккаунт?';
                    this.textContent = 'Войти';
                } else {
                    loginForm.style.display = 'flex';
                    registerForm.style.display = 'none';
                    switchText.textContent = 'Нет аккаунта?';
                    this.textContent = 'Зарегистрироваться';
                }
            };
            console.log('Fallback form toggle enabled');
        }
    }
});
