const DEFAULT_BRANDING = {
    name: "Mi Restaurante",
    desc: "El mejor sabor en cada bocado",
    logo: "",
    cover: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000",
    color: "#8a2be2",
    font: "Inter"
};

const DEFAULT_BANNER = { active: false, msg: "¡Promo especial de apertura!", emoji: "🎉", date: "" };

const app = {
    state: {
        user: null,
        categorias: [],
        productos: [],
        branding: { ...DEFAULT_BRANDING },
        banner: { ...DEFAULT_BANNER }
    },

    init: () => {
        app.loadData();
        app.checkAuth();
        // Check if accessing public menu via URL param ?menu=1
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('menu')) {
            app.ui.switchView('public');
            app.renderPublicMenu();
        }
    },

    loadData: () => {
        const stored = localStorage.getItem('menqr_data');
        if (stored) {
            const data = JSON.parse(stored);
            app.state.categorias = data.categorias || [];
            app.state.productos = data.productos || [];
            app.state.branding = { ...DEFAULT_BRANDING, ...data.branding };
            app.state.banner = { ...DEFAULT_BANNER, ...data.banner };
        }
        app.applyBranding();
    },

    saveData: () => {
        localStorage.setItem('menqr_data', JSON.stringify({
            categorias: app.state.categorias,
            productos: app.state.productos,
            branding: app.state.branding,
            banner: app.state.banner
        }));
        app.renderAdminData();
    },

    login: () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        if (!email || !pass) return alert("Ingresa tus datos");
        
        // Mock login
        app.state.user = { email, id: "restaurant-123" };
        localStorage.setItem('menqr_auth', JSON.stringify(app.state.user));
        
        app.checkAuth();
    },

    checkAuth: () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('menu')) return; // In public mode

        const user = localStorage.getItem('menqr_auth');
        if (user) {
            app.state.user = JSON.parse(user);
            app.ui.switchView('admin');
            app.renderAdminData();
            app.branding.populateForm();
            app.banner.populateForm();
            app.qr.generate();
            app.branding.updatePreview();
        } else {
            app.ui.switchView('landing');
        }
    },

    logout: () => {
        app.state.user = null;
        localStorage.removeItem('menqr_auth');
        app.ui.switchView('landing');
    },

    applyBranding: () => {
        const { color, font } = app.state.branding;
        document.documentElement.style.setProperty('--brand-primary', color);
        document.documentElement.style.setProperty('--brand-font', `"${font}", sans-serif`);
        
        // Cargar fuente
        document.getElementById('theme-font').href = `https://fonts.googleapis.com/css2?family=${font}:wght@300;400;500;600;700&display=swap`;
    },

    // UI Helpers
    ui: {
        switchView: (viewId) => {
            document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
        },
        switchTab: (tabId) => {
            document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            document.querySelector(`.nav-item[data-target="${tabId}"]`).classList.add('active');
            
            if(tabId === 'sec-qr') app.qr.generate();
            if(tabId === 'sec-branding') app.branding.updatePreview();
        },
        showModal: (id) => {
            document.getElementById(id).classList.add('active');
            if(id === 'modal-producto') app.productos.populateCategorySelect();
        },
        closeModal: (id) => {
            document.getElementById(id).classList.remove('active');
            // Clear inputs inside modal
            document.querySelectorAll(`#${id} input, #${id} textarea`).forEach(el => {
                if(el.type !== 'checkbox') el.value = '';
            });
        }
    },

    // Categorias Logic
    categorias: {
        save: () => {
            const name = document.getElementById('cat-name').value.trim();
            if (!name) return;
            
            app.state.categorias.push({ id: Date.now().toString(), name });
            app.saveData();
            app.ui.closeModal('modal-categoria');
        },
        delete: (id) => {
            if(!confirm("¿Borrar categoría? Los productos de esta categoría quedarán sin categoría.")) return;
            app.state.categorias = app.state.categorias.filter(c => c.id !== id);
            // Reset category for products
            app.state.productos = app.state.productos.map(p => p.categoryId === id ? { ...p, categoryId: null } : p);
            app.saveData();
        }
    },

    // Productos Logic
    productos: {
        populateCategorySelect: () => {
            const select = document.getElementById('prod-category');
            select.innerHTML = '<option value="">Sin Categoría</option>' + 
                app.state.categorias.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        },
        save: () => {
            const name = document.getElementById('prod-name').value.trim();
            const price = document.getElementById('prod-price').value;
            if (!name || !price) return alert("Nombre y precio son requeridos");

            const product = {
                id: Date.now().toString(),
                name,
                desc: document.getElementById('prod-desc').value.trim(),
                price: parseFloat(price),
                categoryId: document.getElementById('prod-category').value,
                image: document.getElementById('prod-image').value.trim(),
                available: document.getElementById('prod-avail').checked
            };

            app.state.productos.push(product);
            app.saveData();
            app.ui.closeModal('modal-producto');
        },
        toggleAvailability: (id) => {
            const p = app.state.productos.find(p => p.id === id);
            if(p) {
                p.available = !p.available;
                app.saveData();
            }
        },
        delete: (id) => {
            if(!confirm("¿Borrar producto?")) return;
            app.state.productos = app.state.productos.filter(p => p.id !== id);
            app.saveData();
        }
    },

    // Branding & Banner
    branding: {
        populateForm: () => {
            const b = app.state.branding;
            document.getElementById('brand-name').value = b.name;
            document.getElementById('brand-desc').value = b.desc;
            document.getElementById('brand-logo').value = b.logo;
            document.getElementById('brand-cover').value = b.cover;
            document.getElementById('brand-color').value = b.color;
            document.getElementById('brand-font').value = b.font;
        },
        save: () => {
            app.state.branding = {
                name: document.getElementById('brand-name').value,
                desc: document.getElementById('brand-desc').value,
                logo: document.getElementById('brand-logo').value,
                cover: document.getElementById('brand-cover').value,
                color: document.getElementById('brand-color').value,
                font: document.getElementById('brand-font').value
            };
            app.applyBranding();
            app.saveData();
            alert("Branding guardado");
        },
        updatePreview: () => {
            const preview = document.getElementById('live-preview');
            if(!preview) return;
            
            // Generate temporary branding state from form values
            const tempBrand = {
                name: document.getElementById('brand-name').value || 'Restaurante',
                desc: document.getElementById('brand-desc').value || 'Descripción',
                logo: document.getElementById('brand-logo').value,
                cover: document.getElementById('brand-cover').value,
                color: document.getElementById('brand-color').value || '#8a2be2'
            };
            
            const html = app.generatePublicHTML(tempBrand, app.state.banner);
            preview.innerHTML = html;
            preview.style.setProperty('--brand-primary', tempBrand.color);
        }
    },

    banner: {
        populateForm: () => {
            const b = app.state.banner;
            document.getElementById('banner-active').checked = b.active;
            document.getElementById('banner-msg').value = b.msg;
            document.getElementById('banner-emoji').value = b.emoji;
            document.getElementById('banner-date').value = b.date;
        },
        save: () => {
            app.state.banner = {
                active: document.getElementById('banner-active').checked,
                msg: document.getElementById('banner-msg').value,
                emoji: document.getElementById('banner-emoji').value,
                date: document.getElementById('banner-date').value
            };
            app.saveData();
            app.branding.updatePreview();
            alert("Banner guardado");
        }
    },

    qr: {
        getLink: () => {
            const url = new URL(window.location.href);
            url.searchParams.set('menu', '1');
            return url.href;
        },
        generate: () => {
            const container = document.getElementById('qrcode-render');
            if(!container) return;
            container.innerHTML = ''; // clear
            new QRCode(container, {
                text: app.qr.getLink(),
                width: 200,
                height: 200,
                colorDark : app.state.branding.color,
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        },
        copyLink: () => {
            navigator.clipboard.writeText(app.qr.getLink()).then(() => alert("Enlace copiado"));
        },
        openMenu: () => {
            window.open(app.qr.getLink(), '_blank');
        },
        download: () => {
            const canvas = document.querySelector('#qrcode-render canvas');
            if(canvas) {
                const link = document.createElement('a');
                link.download = 'Mi-Menu-QR.png';
                link.href = canvas.toDataURL();
                link.click();
            }
        }
    },

    // Renders
    renderAdminData: () => {
        if (document.getElementById('view-admin').classList.contains('active')) {
            // Render Categorias
            const catList = document.getElementById('categorias-list');
            catList.innerHTML = app.state.categorias.length ? app.state.categorias.map(c => `
                <div class="list-item">
                    <div class="item-info"><span>${c.name}</span></div>
                    <div class="item-actions">
                        <button class="icon-btn danger" onclick="app.categorias.delete('${c.id}')"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
            `).join('') : '<p style="text-align:center; padding: 2rem 0; opacity: 0.5;">No hay categorías</p>';

            // Render Productos
            const prodList = document.getElementById('productos-list');
            prodList.innerHTML = app.state.productos.length ? app.state.productos.map(p => {
                const cat = app.state.categorias.find(c => c.id === p.categoryId);
                const placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="%23aaa"><rect width="50" height="50" fill="%23eee"/><text x="25" y="30" font-family="sans-serif" font-size="12" text-anchor="middle">Img</text></svg>';
                return `
                <div class="list-item" style="${p.available ? '' : 'opacity: 0.5; filter: grayscale(1);'}">
                    <div class="item-info">
                        <img src="${p.image || placeholder}" class="item-img" alt="${p.name}" onerror="this.src='${placeholder}'">
                        <div>
                            <h4 style="margin:0">${p.name}</h4>
                            <small style="opacity:0.7">${cat ? cat.name : 'Sin categoría'} - $${p.price.toFixed(2)}</small>
                        </div>
                    </div>
                    <div class="item-actions" style="display:flex; align-items:center;">
                        <label class="switch" style="transform: scale(0.7)">
                            <input type="checkbox" ${p.available ? 'checked' : ''} onchange="app.productos.toggleAvailability('${p.id}')">
                            <span class="slider round"></span>
                        </label>
                        <button class="icon-btn danger" onclick="app.productos.delete('${p.id}')"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
            `}).join('') : '<p style="text-align:center; padding: 2rem 0; opacity: 0.5;">No hay productos</p>';

            if (window.lucide) lucide.createIcons();
        }
    },

    // Public Menu Generator
    generatePublicHTML: (brand, bannerInfo) => {
        let bannerHTML = '';
        if (bannerInfo && bannerInfo.active) {
            // Check date validity if date exists
            let showBanner = true;
            if(bannerInfo.date) {
                const today = new Date().toISOString().split('T')[0];
                if(bannerInfo.date < today) showBanner = false;
            }
            if(showBanner) {
                bannerHTML = `<div class="public-banner">${bannerInfo.emoji} ${bannerInfo.msg}</div>`;
            }
        }

        // Categorias UI
        let catHTML = '<div class="public-categories"><div class="cat-chip active">Todo</div>' + 
            app.state.categorias.map(c => `<div class="cat-chip">${c.name}</div>`).join('') + 
            '</div>';

        // Productos UI
        let prodHTML = '<div class="public-products">' + 
            app.state.productos.filter(p => p.available).map(p => {
                const placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="%23aaa"><rect width="80" height="80" fill="%23eee"/><text x="40" y="45" font-family="sans-serif" font-size="12" text-anchor="middle">Img</text></svg>';
                return `
                <div class="pub-product-card">
                    ${p.image ? `<img src="${p.image}" class="pub-product-img" onerror="this.src='${placeholder}'">` : `<img src="${placeholder}" class="pub-product-img">`}
                    <div class="pub-product-info">
                        <h4>${p.name}</h4>
                        <p>${p.desc}</p>
                        <div class="pub-product-price">$${p.price.toFixed(2)}</div>
                    </div>
                </div>
                `;
            }).join('') + '</div>';

        if(app.state.productos.filter(p=>p.available).length === 0) {
            prodHTML = '<p style="text-align:center; padding: 2rem; opacity:0.6">No hay productos disponibles por el momento.</p>';
        }

        const coverStyle = brand.cover ? `background-image: url('${brand.cover}');` : 'background: var(--brand-primary);';
        
        return `
            ${bannerHTML}
            <div class="public-cover" style="${coverStyle}">
                ${brand.logo ? `<img src="${brand.logo}" class="public-logo">` : `<div class="public-logo" style="display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;color:var(--brand-primary)">${brand.name.charAt(0)}</div>`}
            </div>
            <div class="public-info">
                <h2>${brand.name}</h2>
                <p>${brand.desc}</p>
            </div>
            ${catHTML}
            ${prodHTML}
        `;
    },

    renderPublicMenu: () => {
        const container = document.getElementById('view-public');
        container.innerHTML = app.generatePublicHTML(app.state.branding, app.state.banner);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', app.init);
