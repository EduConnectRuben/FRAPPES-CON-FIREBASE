document.addEventListener('DOMContentLoaded', () => {

    // ===================================================================
    // 1. ESTADO GLOBAL DE LA APLICACIÓN
    // ===================================================================
    
    const initialMenuItems = [
        {"id":1,"name":"Frappé de Fresa","category":"frappes","price":8.00,"description":"Dulce y refrescante, hecho con fresas naturales.","image":"images/frappe_fresa.png","stock":15},
        {"id":2,"name":"Frappé de Naranja","category":"frappes","price":8.00,"description":"Un toque cítrico y helado para recargar energías.","image":"images/frappe_naranja.png","stock":15},
        {"id":3,"name":"Frappé de Chocolate","category":"frappes","price":8.00,"description":"Cremoso e intenso, para los amantes del chocolate.","image":"images/frappe_chocolate.png","stock":15},
        {"id":4,"name":"Frappé de Coco","category":"frappes","price":8.00,"description":"Sabor tropical que te transportará a la playa.","image":"images/frappe_coco.png","stock":15},
        {"id":5,"name":"Combo 2x1 Frappés","category":"combos","price":15.00,"description":"¡Lleva dos frappés! Elige tus sabores favoritos.","image":"images/combo.png","stock":15},
        {"id":6,"name":"Café Caliente","category":"calientes","price":5.00,"description":"El clásico café de grano para empezar bien el día.","image":"images/cafe.png","stock":15},
        {"id":7,"name":"Té Caliente","category":"calientes","price":3.00,"description":"Una infusión caliente para relajarte.","image":"images/te.png","stock":15}
    ];

    let menuItems = []; 
    let cart = [];
    let pdfGenerator = null;

    function initApp() {
        listenForStockUpdates();
        loadCartFromStorage();
        setupAllPages();
    }
    
    function listenForStockUpdates() {
        const productsRef = database.ref('products');
        productsRef.on('value', (snapshot) => {
            const productsData = snapshot.val();
            if (productsData) {
                menuItems = Object.values(productsData);
            } else {
                console.log("Base de datos vacía. Subiendo stock inicial...");
                menuItems = initialMenuItems;
                productsRef.set(initialMenuItems); 
            }
            renderMenu();
        }, (error) => {
            console.error("Error al leer datos de Firebase: ", error);
            showNotification("No se pudo conectar al servidor de inventario.", "error");
        });
    }

    // FUNCIÓN MODIFICADA: Ahora acepta el carrito como argumento para mayor seguridad.
    const updateStockAfterPurchase = (finalizedCart) => {
        const updates = {};
        finalizedCart.forEach(cartItem => {
            const productInDb = menuItems.find(item => item.id === cartItem.id);
            if (productInDb) {
                const newStock = productInDb.stock - cartItem.quantity;
                const productIndex = productInDb.id - 1;
                updates[`products/${productIndex}/stock`] = newStock < 0 ? 0 : newStock;
            }
        });

        return database.ref().update(updates);
    };

    function setupAllPages() {
        setupNavigationAndLogin();
        setupSuccessModal();
        updateCartCounter();
        setupMenuPage();
        setupCartPage();
        setupReservationPage();
    }

    const loadCartFromStorage = () => cart = JSON.parse(localStorage.getItem('shoppingCart')) || [];
    const saveCartToStorage = () => { localStorage.setItem('shoppingCart', JSON.stringify(cart)); updateCartCounter(); };

    const addToCart = (itemId) => {
        const itemInMenu = menuItems.find(i => i.id === itemId);
        if (!itemInMenu || itemInMenu.stock <= 0) {
            return showNotification(`Lo sentimos, ${itemInMenu.name} está agotado.`, 'error');
        }
        
        const itemInCart = cart.find(i => i.id === itemId);
        const quantityInCart = itemInCart ? itemInCart.quantity : 0;
        
        if (quantityInCart >= itemInMenu.stock) {
            return showNotification(`No hay más stock de ${itemInMenu.name}`, 'error');
        }
        
        if (itemInCart) {
            itemInCart.quantity++;
        } else {
            cart.push({ ...itemInMenu, quantity: 1 });
        }
        
        showNotification(`${itemInMenu.name} añadido al carrito!`);
        saveCartToStorage();
        renderMenu();
    };

    const updateCartQuantity = (itemId, newQuantity) => {
        const cartItem = cart.find(i => i.id === itemId);
        if (!cartItem) return;

        const itemInMenu = menuItems.find(i => i.id === itemId);
        if (newQuantity > itemInMenu.stock) {
            newQuantity = itemInMenu.stock;
            showNotification(`Solo quedan ${itemInMenu.stock} unidades de ${itemInMenu.name}.`, 'error');
        }

        if (newQuantity <= 0) {
            cart = cart.filter(i => i.id !== itemId);
        } else {
            cartItem.quantity = newQuantity;
        }

        saveCartToStorage();
        renderCartPage();
        renderMenu();
    };
    
    const updateCartCounter = () => {
        const counter = document.getElementById('cart-counter');
        if (counter) counter.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    };

    function renderMenu() {
        const menuGrid = document.getElementById('menu-grid');
        if (!menuGrid) return;
        
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        const category = document.getElementById('category-filter')?.value || 'all';
        
        let itemsToRender = menuItems;
        if (category !== 'all') itemsToRender = itemsToRender.filter(item => item.category === category);
        if (searchTerm) itemsToRender = itemsToRender.filter(item => item.name.toLowerCase().includes(searchTerm));
        
        menuGrid.innerHTML = '';
        if (!itemsToRender || itemsToRender.length === 0) {
            menuGrid.innerHTML = '<p style="text-align: center;">No se encontraron productos.</p>';
            return;
        }
        
        itemsToRender.forEach(item => {
            const quantityInCart = cart.find(ci => ci.id === item.id)?.quantity || 0;
            const currentStock = item.stock;
            const availableStock = currentStock - quantityInCart;
            
            let stockStatus, stockText;
            if (currentStock > 10) { stockStatus = 'available'; stockText = 'Disponible'; } 
            else if (currentStock > 5) { stockStatus = 'few-left'; stockText = `¡Quedan solo ${currentStock}!`; } 
            else if (currentStock > 0) { stockStatus = 'last-units'; stockText = `¡Últimas ${currentStock} unidades!`; } 
            else { stockStatus = 'not-available'; stockText = 'Agotado'; }
            
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<img src="${item.image}" alt="${item.name}" class="card-img"><div class="card-body"><h3 class="card-title">${item.name}</h3><p class="card-text">${item.description}</p><div class="card-footer"><div><p class="price">Bs ${item.price.toFixed(2)}</p><span class="stock ${stockStatus}">${stockText}</span></div><button class="add-to-cart-btn" data-id="${item.id}" ${availableStock <= 0 ? 'disabled' : ''}>Añadir</button></div></div>`;
            menuGrid.appendChild(card);
        });
    }
    
    function renderCartPage() {
        const cartItemsList = document.getElementById('cart-items-list');
        if (!cartItemsList) return;
        const cartTotalPrice = document.getElementById('cart-total-price');
        const checkoutBtn = document.getElementById('checkout-btn');
        cartItemsList.innerHTML = '';
        if (cart.length === 0) {
            cartItemsList.innerHTML = '<p>Tu carrito está vacío. <a href="menu.html">¡Ve a llenarlo!</a></p>';
            cartTotalPrice.textContent = 'Bs 0.00';
            checkoutBtn.disabled = true;
            return;
        }
        checkoutBtn.disabled = false;
        let total = 0;
        cart.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${item.name}</h4>
                    <p class="cart-item-price">Bs ${item.price.toFixed(2)}</p>
                </div>
                <div class="cart-item-actions">
                    <div class="quantity-controls">
                        <button class="quantity-btn" data-id="${item.id}" data-action="decrease">-</button>
                        <input type="number" value="${item.quantity}" min="1" max="${item.stock}" data-id="${item.id}" class="quantity-input" readonly>
                        <button class="quantity-btn" data-id="${item.id}" data-action="increase">+</button>
                    </div>
                    <button class="remove-item-btn" data-id="${item.id}">&times;</button>
                </div>`;
            cartItemsList.appendChild(itemElement);
            total += item.price * item.quantity;
        });
        cartTotalPrice.textContent = `Bs ${total.toFixed(2)}`;
    }

    function setupMenuPage() {
        const menuPageContent = document.getElementById('menu-grid');
        if (!menuPageContent) return;
        renderMenu();
        const searchInput = document.getElementById('search-input');
        const categoryFilter = document.getElementById('category-filter');
        if (searchInput) searchInput.addEventListener('input', renderMenu);
        if (categoryFilter) categoryFilter.addEventListener('change', renderMenu);
        menuPageContent.addEventListener('click', e => {
            if (e.target.classList.contains('add-to-cart-btn')) addToCart(Number(e.target.dataset.id));
        });
    }

    // ======================= FUNCIÓN CLAVE ACTUALIZADA =======================
    function setupCartPage() {
        const cartContainer = document.getElementById('cart-container');
        if (!cartContainer) return;

        cartContainer.addEventListener('click', e => {
            const target = e.target;
            const itemId = Number(target.dataset.id);
            if (target.classList.contains('remove-item-btn')) updateCartQuantity(itemId, 0);
            if (target.classList.contains('quantity-btn')) {
                const action = target.dataset.action;
                const cartItem = cart.find(item => item.id === itemId);
                if (cartItem) {
                    let newQuantity = cartItem.quantity;
                    if (action === 'increase') newQuantity++;
                    else if (action === 'decrease') newQuantity--;
                    updateCartQuantity(itemId, newQuantity);
                }
            }
        });

        const checkoutBtn = document.getElementById('checkout-btn');
        if (!checkoutBtn) return;

        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) return;

            // 1. Guardar una copia del carrito actual para procesarlo de forma segura.
            const finalizedCart = [...cart];

            // 2. Actualizar el stock en Firebase.
            updateStockAfterPurchase(finalizedCart)
                .then(() => {
                    console.log("¡Stock actualizado en Firebase con éxito!");
                })
                .catch((error) => {
                    console.error("Error al actualizar el stock en Firebase:", error);
                    showNotification("Hubo un error al procesar tu pedido. Inténtalo de nuevo.", "error");
                    return; // Detener el proceso si la actualización del stock falla.
                });

            // 3. Abrir WhatsApp con los detalles del pedido.
            const yourWhatsappNumber = '59174420831'; 
            let orderMessage = `¡Hola Frappés Valentina! 👋 Quisiera hacer el siguiente pedido:\n\n`;
            let total = 0;
            finalizedCart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                orderMessage += `*${item.quantity}x* - ${item.name}\n`;
                total += itemTotal;
            });
            orderMessage += `\n*TOTAL: Bs ${total.toFixed(2)}*`;
            const encodedMessage = encodeURIComponent(orderMessage);
            const whatsappUrl = `https://wa.me/${yourWhatsappNumber}?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
            
            // 4. Mostrar el modal de éxito. Le pasamos la CCOPIA del carrito a la función del PDF.
            showSuccessModal(
                '¡Pedido listo para enviar!', 
                'Se abrirá WhatsApp para que completes tu pedido. También puedes descargar tu comprobante.', 
                () => generateOrderPDF(finalizedCart) // La función para el PDF usará la copia guardada.
            );

            // 5. Vaciar el carrito principal de la UI inmediatamente.
            cart = []; 
            saveCartToStorage(); 
            renderCartPage();
        });

        renderCartPage();
    }
    // =======================================================================

    function setupReservationPage() {
        const reservationForm = document.getElementById('reservation-form');
        if (!reservationForm) return;
        reservationForm.addEventListener('submit', e => {
            e.preventDefault();
            const reservationData = Object.fromEntries(new FormData(reservationForm).entries());
            const yourWhatsappNumber = '59174420831';
            let reservationMessage = `¡Hola Frappés Valentina! 👋 Quisiera hacer una reserva:\n\n*Nombre:* ${reservationData.name}\n*Fecha:* ${reservationData.date}\n*Hora:* ${reservationData.time}\n*Personas:* ${reservationData.guests}\n\n¡Por favor confirmar!`;
            const encodedMessage = encodeURIComponent(reservationMessage);
            const whatsappUrl = `https://wa.me/${yourWhatsappNumber}?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
            showSuccessModal('¡Reserva lista para enviar!', 'Se abrirá WhatsApp para que nos envíes los detalles.', () => generateReservationPDF(reservationData));
            reservationForm.reset();
        });
    }

    function setupNavigationAndLogin() {
        const navToggle = document.querySelector('.mobile-nav-toggle');
        const primaryNav = document.getElementById('primary-navigation');
        if (navToggle && primaryNav) {
            navToggle.addEventListener('click', () => {
                const isVisible = primaryNav.getAttribute('data-visible') === 'true';
                primaryNav.setAttribute('data-visible', !isVisible);
                navToggle.setAttribute('aria-expanded', !isVisible);
            });
        }
    }

    function setupSuccessModal() {
        const successModal = document.getElementById('success-modal');
        const closeBtn = document.getElementById('close-success-modal-btn');
        const generatePdfBtn = document.getElementById('generate-pdf-btn');
        if (successModal && closeBtn && generatePdfBtn) {
            closeBtn.addEventListener('click', () => successModal.classList.remove('show'));
            generatePdfBtn.addEventListener('click', () => {
                if (typeof pdfGenerator === 'function') pdfGenerator();
                successModal.classList.remove('show');
            });
        }
    }

    function showSuccessModal(title, message, pdfGenFunc) {
        const modalTitle = document.getElementById('success-modal-title');
        const modalMessage = document.getElementById('success-modal-message');
        const successModal = document.getElementById('success-modal');
        if (modalTitle && modalMessage && successModal) {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            pdfGenerator = pdfGenFunc;
            successModal.classList.add('show');
        }
    }

    // FUNCIÓN MODIFICADA: Acepta un carrito como argumento para generar el PDF.
    function generateOrderPDF(finalizedCart) {
        if (typeof window.jspdf === 'undefined') return showNotification("Error: Librería PDF no cargada.", "error");
        if (!finalizedCart || finalizedCart.length === 0) return showNotification("No hay nada que imprimir.", "error");
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(22); doc.setFont('helvetica', 'bold');
        doc.text('Comprobante de Pedido - Frappés Valentina', 105, 20, { align: 'center' });
        
        doc.setFontSize(12); doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 35);
        doc.text(`Cliente: Invitado`, 20, 41);
        
        const tableColumn = ["Producto", "Cantidad", "Precio Unit.", "Subtotal"];
        const tableRows = [];
        let total = 0;
        
        finalizedCart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            tableRows.push([item.name, item.quantity, `Bs ${item.price.toFixed(2)}`, `Bs ${itemTotal.toFixed(2)}`]);
            total += itemTotal;
        });
        
        doc.autoTable({ head: [tableColumn], body: tableRows, startY: 50 });
        
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text(`Total a Pagar: Bs ${total.toFixed(2)}`, 190, doc.lastAutoTable.finalY + 15, { align: 'right' });

        const pdfDataUri = doc.output('datauristring');
        window.open(pdfDataUri, '_blank');
    }

    function generateReservationPDF(data) {
        if (typeof window.jspdf === 'undefined') return showNotification("Error: Librería PDF no cargada.", "error");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(22); doc.setFont('helvetica', 'bold');
        doc.text('Comprobante de Reserva - Frappés Valentina', 105, 20, { align: 'center' });
        doc.setFontSize(12); doc.setFont('helvetica', 'normal');
        doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 20, 35);
        doc.text(`Reservado por: ${data.name}`, 20, 41);
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('Detalles de la Reserva', 20, 60);
        doc.autoTable({ startY: 65, theme: 'plain', body: [['Nombre:', data.name], ['Email:', data.email], ['Fecha:', data.date], ['Hora:', data.time], ['Personas:', data.guests]] });
        doc.setFontSize(10);
        doc.text('Por favor, presenta este comprobante al llegar a la tienda.', 20, doc.lastAutoTable.finalY + 20);
        
        const pdfDataUri = doc.output('datauristring');
        window.open(pdfDataUri, '_blank');
    }

    function showNotification(message, type = 'success') {
        const el = document.getElementById('notification');
        if (!el) return;
        el.textContent = message;
        el.style.backgroundImage = type === 'error' ? 'linear-gradient(to right, #D32F2F, #E64A19)' : 'var(--gradiente-principal)';
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 3000);
    };
    
    initApp();
});
