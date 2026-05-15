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
        restaurantId: null,
        categorias: [],
        productos: [],
        branding: { ...DEFAULT_BRANDING },
        banner: { ...DEFAULT_BANNER }
    },

    init: async () => {
        // Check if accessing public menu via URL param ?menu=UUID
        const urlParams = new URLSearchParams(window.location.search);
        const menuId = urlParams.get('menu');
        
        if (menuId) {
            app.ui.switchView('public');
            await app.loadPublicData(menuId);
        } else {
            await app.checkAuth();
        }
    },

    loadPublicData: async (restaurantId) => {
        try {
            // Load restaurant config
            const { data: restData, error: restErr } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', restaurantId)
                .single();

            if (restErr || !restData) {
                document.getElementById('view-public').innerHTML = '<p style="text-align:center; padding: 3rem;">Menú no encontrado.</p>';
                return;
            }

            app.state.branding = {
                name: restData.name || DEFAULT_BRANDING.name,
                desc: restData.description || DEFAULT_BRANDING.desc,
                logo: restData.logo_url || "",
                cover: restData.cover_url || DEFAULT_BRANDING.cover,
                color: restData.primary_color || DEFAULT_BRANDING.color,
                font: restData.font_family || DEFAULT_BRANDING.font
            };

            app.state.banner = {
                active: restData.banner_active,
                msg: restData.banner_msg || "",
                emoji: restData.banner_emoji || "",
                date: restData.banner_date || ""
            };

            // Load Categories
            const { data: catData } = await supabase
                .from('categories')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: true });
            
            if (catData) app.state.categorias = catData;

            // Load Products
            const { data: prodData } = await supabase
                .from('products')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: true });
            
            if (prodData) app.state.productos = prodData;

            app.applyBranding();
            app.renderPublicMenu();
        } catch (error) {
            console.error("Error loading public data:", error);
        }
    },

    loadAdminData: async () => {
        try {
            // Fetch restaurant for current user
            let { data: restData, error } = await supabase
                .from('restaurants')
                .select('*')
                .eq('user_id', app.state.user.id)
                .single();

            // If no restaurant exists, create one
            if (!restData) {
                const { data: newRest, error: createErr } = await supabase
                    .from('restaurants')
                    .insert([{ user_id: app.state.user.id }])
                    .select()
                    .single();
                
                if (createErr) throw createErr;
                restData = newRest;
            }

            app.state.restaurantId = restData.id;

            app.state.branding = {
                name: restData.name || DEFAULT_BRANDING.name,
                desc: restData.description || DEFAULT_BRANDING.desc,
                logo: restData.logo_url || "",
                cover: restData.cover_url || DEFAULT_BRANDING.cover,
                color: restData.primary_color || DEFAULT_BRANDING.color,
                font: restData.font_family || DEFAULT_BRANDING.font
            };

            app.state.banner = {
                active: restData.banner_active,
                msg: restData.banner_msg || "",
                emoji: restData.banner_emoji || "",
                date: restData.banner_date || ""
            };

            // Fetch categories
            const { data: catData } = await supabase
                .from('categories')
                .select('*')
                .eq('restaurant_id', app.state.restaurantId)
                .order('created_at', { ascending: true });
            if (catData) app.state.categorias = catData;

            // Fetch products
            const { data: prodData } = await supabase
                .from('products')
                .select('*')
                .eq('restaurant_id', app.state.restaurantId)
                .order('created_at', { ascending: true });
            if (prodData) app.state.productos = prodData;

            app.applyBranding();
            app.renderAdminData();
            app.branding.populateForm();
            app.banner.populateForm();
            app.qr.generate();
            app.branding.updatePreview();

        } catch (error) {
            console.error("Error loading admin data:", error);
            alert("Hubo un error cargando tus datos.");
        }
    },

    auth: {
        showMessage: (msg, type = 'success') => {
            const msgEl = document.getElementById('auth-message');
            if (msgEl) {
                msgEl.textContent = msg;
                msgEl.style.display = 'block';
                msgEl.style.backgroundColor = type === 'success' ? '#dcfce7' : '#fee2e2';
                msgEl.style.color = type === 'success' ? '#166534' : '#991b1b';
                msgEl.style.border = `1px solid ${type === 'success' ? '#86efac' : '#fca5a5'}`;
            } else {
                alert(msg);
            }
        },
        switchTab: (tab) => {
            document.querySelectorAll('.auth-tab').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(el => {
                el.style.display = 'none';
            });
            const msgEl = document.getElementById('auth-message');
            if(msgEl) msgEl.style.display = 'none'; // hide message when switching tabs
            
            document.querySelector(`.auth-tab[onclick*="${tab}"]`).classList.add('active');
            document.getElementById(`form-${tab}`).style.display = 'flex';
        },
        login: async () => {
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            if (!email || !pass) return app.auth.showMessage("Ingresa tus datos", "error");
            
            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: pass
                });

                if (error) {
                    return app.auth.showMessage(error.message, "error");
                } else {
                    app.state.user = data.user;
                    app.ui.switchView('admin');
                    await app.loadAdminData();
                }
            } catch (error) {
                console.error(error);
                app.auth.showMessage("Error inesperado", "error");
            }
        },
        register: async () => {
            const email = document.getElementById('register-email').value;
            const pass = document.getElementById('register-password').value;
            const passConfirm = document.getElementById('register-password-confirm').value;
            
            if (!email || !pass) return app.auth.showMessage("Ingresa tus datos", "error");
            if (pass !== passConfirm) return app.auth.showMessage("Las contraseñas no coinciden", "error");
            
            try {
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: pass
                });
                
                if (error) {
                    return app.auth.showMessage(error.message, "error");
                }
                
                if (data.session) {
                    app.auth.showMessage("¡Registro exitoso! Entrando...", "success");
                    setTimeout(async () => {
                        app.state.user = data.user;
                        app.ui.switchView('admin');
                        await app.loadAdminData();
                    }, 1000);
                } else {
                    app.auth.showMessage("¡Cuenta creada exitosamente! Revisa tu bandeja de entrada para confirmarla.", "success");
                    setTimeout(() => {
                        app.auth.switchTab('login');
                    }, 3000);
                }
            } catch (error) {
                console.error(error);
                app.auth.showMessage("Error inesperado", "error");
            }
        }
    },

    checkAuth: async () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('menu')) return; // In public mode

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            app.state.user = session.user;
            app.ui.switchView('admin');
            await app.loadAdminData();
        } else {
            app.ui.switchView('landing');
        }

        // Listen for auth state changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                app.state.user = null;
                app.ui.switchView('landing');
            } else if (event === 'SIGNED_IN' && session) {
                app.state.user = session.user;
                // Avoid reloading if already on admin
                if(!document.getElementById('view-admin').classList.contains('active')) {
                    app.ui.switchView('admin');
                    await app.loadAdminData();
                }
            }
        });
    },

    logout: async () => {
        await supabase.auth.signOut();
    },

    applyBranding: () => {
        const { color, font } = app.state.branding;
        document.documentElement.style.setProperty('--brand-primary', color);
        document.documentElement.style.setProperty('--brand-font', `"${font}", sans-serif`);
        
        // Cargar fuente
        document.getElementById('theme-font').href = `https://fonts.googleapis.com/css2?family=${font}:wght@300;400;500;600;700&display=swap`;
    },

    uploadImage: async (fileInputId) => {
        const input = document.getElementById(fileInputId);
        if (!input || !input.files || input.files.length === 0) return null;

        const file = input.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${app.state.user.id}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('menqr-media')
            .upload(filePath, file);

        if (error) {
            console.error("Upload error:", error);
            alert("Error subiendo la imagen");
            return null;
        }

        const { data: publicUrlData } = supabase.storage
            .from('menqr-media')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
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
            document.querySelectorAll(`#${id} input:not([type="checkbox"]), #${id} textarea`).forEach(el => {
                el.value = '';
            });
            // Reset files
            document.querySelectorAll(`#${id} input[type="file"]`).forEach(el => {
                el.value = '';
            });
        }
    },

    // Categorias Logic
    categorias: {
        save: async () => {
            const name = document.getElementById('cat-name').value.trim();
            if (!name) return;
            
            const { data, error } = await supabase
                .from('categories')
                .insert([{ restaurant_id: app.state.restaurantId, name: name }])
                .select()
                .single();
            
            if (error) {
                return alert("Error guardando categoría");
            }

            app.state.categorias.push(data);
            app.renderAdminData();
            app.ui.closeModal('modal-categoria');
        },
        delete: async (id) => {
            if(!confirm("¿Borrar categoría? Los productos de esta categoría quedarán sin categoría.")) return;
            
            const { error } = await supabase.from('categories').delete().eq('id', id);
            
            if(error) return alert("Error borrando categoría");

            app.state.categorias = app.state.categorias.filter(c => c.id !== id);
            // Reset category for products locally (DB does this via ON DELETE SET NULL)
            app.state.productos = app.state.productos.map(p => p.category_id === id ? { ...p, category_id: null } : p);
            app.renderAdminData();
        }
    },

    // Productos Logic
    productos: {
        populateCategorySelect: () => {
            const select = document.getElementById('prod-category');
            select.innerHTML = '<option value="">Sin Categoría</option>' + 
                app.state.categorias.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        },
        save: async () => {
            const name = document.getElementById('prod-name').value.trim();
            const price = document.getElementById('prod-price').value;
            if (!name || !price) return alert("Nombre y precio son requeridos");

            // Upload image if present
            let imageUrl = await app.uploadImage('prod-image');

            const categoryId = document.getElementById('prod-category').value;

            const productData = {
                restaurant_id: app.state.restaurantId,
                name: name,
                description: document.getElementById('prod-desc').value.trim(),
                price: parseFloat(price),
                category_id: categoryId ? categoryId : null,
                available: document.getElementById('prod-avail').checked
            };

            if (imageUrl) productData.image_url = imageUrl;

            const { data, error } = await supabase
                .from('products')
                .insert([productData])
                .select()
                .single();

            if (error) return alert("Error guardando producto: " + error.message);

            app.state.productos.push(data);
            app.renderAdminData();
            app.ui.closeModal('modal-producto');
        },
        toggleAvailability: async (id) => {
            const p = app.state.productos.find(p => p.id === id);
            if(p) {
                const newAvail = !p.available;
                const { error } = await supabase
                    .from('products')
                    .update({ available: newAvail })
                    .eq('id', id);

                if(!error) {
                    p.available = newAvail;
                    app.renderAdminData();
                } else {
                    alert("Error actualizando disponibilidad");
                }
            }
        },
        delete: async (id) => {
            if(!confirm("¿Borrar producto?")) return;
            
            const { error } = await supabase.from('products').delete().eq('id', id);
            
            if(error) return alert("Error borrando producto");

            app.state.productos = app.state.productos.filter(p => p.id !== id);
            app.renderAdminData();
        }
    },

    // Branding & Banner
    branding: {
        populateForm: () => {
            const b = app.state.branding;
            document.getElementById('brand-name').value = b.name;
            document.getElementById('brand-desc').value = b.desc;
            document.getElementById('brand-color').value = b.color;
            document.getElementById('brand-font').value = b.font;
            // File inputs cannot be populated with URLs
        },
        save: async () => {
            const name = document.getElementById('brand-name').value;
            const desc = document.getElementById('brand-desc').value;
            const color = document.getElementById('brand-color').value;
            const font = document.getElementById('brand-font').value;

            let logoUrl = await app.uploadImage('brand-logo');
            let coverUrl = await app.uploadImage('brand-cover');

            const updateData = {
                name: name,
                description: desc,
                primary_color: color,
                font_family: font
            };

            if (logoUrl) updateData.logo_url = logoUrl;
            if (coverUrl) updateData.cover_url = coverUrl;

            const { error } = await supabase
                .from('restaurants')
                .update(updateData)
                .eq('id', app.state.restaurantId);

            if(error) return alert("Error guardando branding");

            app.state.branding = {
                ...app.state.branding,
                name: name,
                desc: desc,
                color: color,
                font: font
            };
            if(logoUrl) app.state.branding.logo = logoUrl;
            if(coverUrl) app.state.branding.cover = coverUrl;

            app.applyBranding();
            app.branding.updatePreview();
            alert("Branding guardado");
        },
        updatePreview: () => {
            const preview = document.getElementById('live-preview');
            if(!preview) return;
            
            // Generate temporary branding state from form values
            const tempBrand = {
                name: document.getElementById('brand-name').value || 'Restaurante',
                desc: document.getElementById('brand-desc').value || 'Descripción',
                logo: app.state.branding.logo, // keep existing as file inputs aren't immediate previews easily
                cover: app.state.branding.cover,
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
        save: async () => {
            const active = document.getElementById('banner-active').checked;
            const msg = document.getElementById('banner-msg').value;
            const emoji = document.getElementById('banner-emoji').value;
            const date = document.getElementById('banner-date').value;

            const { error } = await supabase
                .from('restaurants')
                .update({
                    banner_active: active,
                    banner_msg: msg,
                    banner_emoji: emoji,
                    banner_date: date || null
                })
                .eq('id', app.state.restaurantId);

            if (error) return alert("Error guardando banner");

            app.state.banner = { active, msg, emoji, date };
            app.branding.updatePreview();
            alert("Banner guardado");
        }
    },

    qr: {
        getLink: () => {
            const url = new URL(window.location.href);
            // Clear existing params just in case
            url.search = '';
            url.searchParams.set('menu', app.state.restaurantId);
            return url.href;
        },
        generate: () => {
            const container = document.getElementById('qrcode-render');
            if(!container || !app.state.restaurantId) return;
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
                const cat = app.state.categorias.find(c => c.id === p.category_id);
                const placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="%23aaa"><rect width="50" height="50" fill="%23eee"/><text x="25" y="30" font-family="sans-serif" font-size="12" text-anchor="middle">Img</text></svg>';
                return `
                <div class="list-item" style="${p.available ? '' : 'opacity: 0.5; filter: grayscale(1);'}">
                    <div class="item-info">
                        <img src="${p.image_url || placeholder}" class="item-img" alt="${p.name}" onerror="this.src='${placeholder}'">
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
                    ${p.image_url ? `<img src="${p.image_url}" class="pub-product-img" onerror="this.src='${placeholder}'">` : `<img src="${placeholder}" class="pub-product-img">`}
                    <div class="pub-product-info">
                        <h4>${p.name}</h4>
                        <p>${p.description || p.desc || ''}</p>
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
