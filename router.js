const router = {
    currentPage: 'home',
    
    init() {
        this.handleHashChange();
        window.addEventListener('hashchange', () => this.handleHashChange());
    },
    
    handleHashChange() {
        const hash = window.location.hash.slice(1);
        const [page, query] = hash.split('?');
        
        if (page) {
            this.showPage(page);
            this.updateNav(page);
        } else {
            this.showPage('home');
        }
        
        if (query) {
            const params = new URLSearchParams(query);
            this.handleParams(params);
        }
    },
    
    navigate(page, params = {}) {
        let url = `#${page}`;
        if (Object.keys(params).length > 0) {
            url += '?' + new URLSearchParams(params).toString();
        }
        window.location.hash = url;
    },
    
    showPage(page) {
        document.querySelectorAll('.page-view').forEach(el => {
            el.style.display = 'none';
        });
        
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) {
            pageEl.style.display = 'block';
            this.currentPage = page;
        }
        
        const sidebar = document.getElementById('sidebar');
        sidebar.style.display = 'flex';
        
        if (page === 'home') {
            loadAccountData();
        } else if (page === 'import') {
            loadAccountData();
        } else if (page === 'accounts') {
            loadAccountData();
        } else if (page === 'works') {
            loadAccountData();
        }
    },
    
    updateNav(page) {
        document.querySelectorAll('.sidebar-item').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.page === page) {
                el.classList.add('active');
            }
        });
    },
    
    handleParams(params) {
        if (params.has('platform')) {
            const platform = params.get('platform');
            switchAccountPlatform(platform);
        }
    },
    
    getParams() {
        const hash = window.location.hash.slice(1);
        const [, query] = hash.split('?');
        return query ? new URLSearchParams(query) : new URLSearchParams();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    router.init();
    setTimeout(() => {
        router.navigate('home');
    }, 100);
});