const SUPABASE_URL = 'https://dkyqegxdcerlqnfvodjd.supabase.co';  // ЗАМЕНИТЕ!
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreXFlZ3hkY2VybHFuZnZvZGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTc2NzQsImV4cCI6MjA4NTYzMzY3NH0.n6KO-IQMZboeOMCnJQw6gAs8DdWFDZpevAOWBQrxFWA';  // ЗАМЕНИТЕ!

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
            // Пробуем найти пользователя в таблице profiles
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('username', username)
                .single();

            if (profileError || !profile) {
                this.showError('Пользователь не найден');
                return;
            }

            // Входим с email из профиля
            const { data, error } = await supabase.auth.signInWithPassword({
                email: profile.email,
                password: password
            });

            if (error) throw error;

            this.currentUser = data.user;
            await this.getUserRole(data.user.id);
            
            // Сохраняем данные в sessionStorage
            sessionStorage.setItem('user_id', data.user.id);
            sessionStorage.setItem('user_email', profile.email);
            sessionStorage.setItem('user_username', username);
            
            // Перенаправляем на дашборд
            window.location.href = 'dashboard.html';

        } catch (error) {
            this.showError('Неверный логин или пароль');
            console.error('Login error:', error);
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
            // 1. Регистрация в Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password
            });

            if (error) throw error;

            // 2. Ждем немного, чтобы пользователь создался
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 3. Получаем текущую сессию
            const { data: sessionData } = await supabase.auth.getSession();
            
            if (!sessionData.session) {
                throw new Error('Сессия не создана');
            }

            const userId = sessionData.session.user.id;

            // 4. Создаем профиль в таблице profiles
            const { error: profileError } = await supabase
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
                
                // Если ошибка "duplicate key", значит пользователь уже есть
                if (profileError.code === '23505') {
                    this.showError('Пользователь с таким именем или email уже существует');
                } else {
                    throw profileError;
                }
                return;
            }

            this.showError('✅ Регистрация успешна! Теперь войдите.', 'success');
            
            // Очищаем форму
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm-password').value = '';
            
            // Переключение на форму входа
            setTimeout(() => {
                this.toggleFormMode();
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Ошибка регистрации: ' + error.message);
        }
    }

    async getUserRole(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role, username')
                .eq('id', userId)
                .single();

            if (!error && data) {
                this.currentRole = data.role;
                sessionStorage.setItem('user_role', data.role);
                sessionStorage.setItem('user_username', data.username);
            }
        } catch (error) {
            console.error('Get role error:', error);
        }
    }

    async checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                this.currentUser = session.user;
                await this.getUserRole(session.user.id);
                
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
        if (!errorElement) return;
        
        errorElement.textContent = message;
        errorElement.className = `auth-error ${type}`;
        errorElement.style.display = message ? 'block' : 'none';
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
});const SUPABASE_URL = 'https://ваш-проект.supabase.co';  // ЗАМЕНИТЕ!
const SUPABASE_ANON_KEY = 'ваш-anon-key';  // ЗАМЕНИТЕ!

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
            // Пробуем найти пользователя в таблице profiles
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('username', username)
                .single();

            if (profileError || !profile) {
                this.showError('Пользователь не найден');
                return;
            }

            // Входим с email из профиля
            const { data, error } = await supabase.auth.signInWithPassword({
                email: profile.email,
                password: password
            });

            if (error) throw error;

            this.currentUser = data.user;
            await this.getUserRole(data.user.id);
            
            // Сохраняем данные в sessionStorage
            sessionStorage.setItem('user_id', data.user.id);
            sessionStorage.setItem('user_email', profile.email);
            sessionStorage.setItem('user_username', username);
            
            // Перенаправляем на дашборд
            window.location.href = 'dashboard.html';

        } catch (error) {
            this.showError('Неверный логин или пароль');
            console.error('Login error:', error);
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
            // 1. Регистрация в Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password
            });

            if (error) throw error;

            // 2. Ждем немного, чтобы пользователь создался
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 3. Получаем текущую сессию
            const { data: sessionData } = await supabase.auth.getSession();
            
            if (!sessionData.session) {
                throw new Error('Сессия не создана');
            }

            const userId = sessionData.session.user.id;

            // 4. Создаем профиль в таблице profiles
            const { error: profileError } = await supabase
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
                
                // Если ошибка "duplicate key", значит пользователь уже есть
                if (profileError.code === '23505') {
                    this.showError('Пользователь с таким именем или email уже существует');
                } else {
                    throw profileError;
                }
                return;
            }

            this.showError('✅ Регистрация успешна! Теперь войдите.', 'success');
            
            // Очищаем форму
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm-password').value = '';
            
            // Переключение на форму входа
            setTimeout(() => {
                this.toggleFormMode();
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Ошибка регистрации: ' + error.message);
        }
    }

    async getUserRole(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role, username')
                .eq('id', userId)
                .single();

            if (!error && data) {
                this.currentRole = data.role;
                sessionStorage.setItem('user_role', data.role);
                sessionStorage.setItem('user_username', data.username);
            }
        } catch (error) {
            console.error('Get role error:', error);
        }
    }

    async checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                this.currentUser = session.user;
                await this.getUserRole(session.user.id);
                
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
        if (!errorElement) return;
        
        errorElement.textContent = message;
        errorElement.className = `auth-error ${type}`;
        errorElement.style.display = message ? 'block' : 'none';
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
});const SUPABASE_URL = 'https://ваш-проект.supabase.co';  // ЗАМЕНИТЕ!
const SUPABASE_ANON_KEY = 'ваш-anon-key';  // ЗАМЕНИТЕ!

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
            // Пробуем найти пользователя в таблице profiles
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('username', username)
                .single();

            if (profileError || !profile) {
                this.showError('Пользователь не найден');
                return;
            }

            // Входим с email из профиля
            const { data, error } = await supabase.auth.signInWithPassword({
                email: profile.email,
                password: password
            });

            if (error) throw error;

            this.currentUser = data.user;
            await this.getUserRole(data.user.id);
            
            // Сохраняем данные в sessionStorage
            sessionStorage.setItem('user_id', data.user.id);
            sessionStorage.setItem('user_email', profile.email);
            sessionStorage.setItem('user_username', username);
            
            // Перенаправляем на дашборд
            window.location.href = 'dashboard.html';

        } catch (error) {
            this.showError('Неверный логин или пароль');
            console.error('Login error:', error);
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
            // 1. Регистрация в Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password
            });

            if (error) throw error;

            // 2. Ждем немного, чтобы пользователь создался
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 3. Получаем текущую сессию
            const { data: sessionData } = await supabase.auth.getSession();
            
            if (!sessionData.session) {
                throw new Error('Сессия не создана');
            }

            const userId = sessionData.session.user.id;

            // 4. Создаем профиль в таблице profiles
            const { error: profileError } = await supabase
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
                
                // Если ошибка "duplicate key", значит пользователь уже есть
                if (profileError.code === '23505') {
                    this.showError('Пользователь с таким именем или email уже существует');
                } else {
                    throw profileError;
                }
                return;
            }

            this.showError('✅ Регистрация успешна! Теперь войдите.', 'success');
            
            // Очищаем форму
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm-password').value = '';
            
            // Переключение на форму входа
            setTimeout(() => {
                this.toggleFormMode();
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Ошибка регистрации: ' + error.message);
        }
    }

    async getUserRole(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role, username')
                .eq('id', userId)
                .single();

            if (!error && data) {
                this.currentRole = data.role;
                sessionStorage.setItem('user_role', data.role);
                sessionStorage.setItem('user_username', data.username);
            }
        } catch (error) {
            console.error('Get role error:', error);
        }
    }

    async checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                this.currentUser = session.user;
                await this.getUserRole(session.user.id);
                
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
        if (!errorElement) return;
        
        errorElement.textContent = message;
        errorElement.className = `auth-error ${type}`;
        errorElement.style.display = message ? 'block' : 'none';
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
});
