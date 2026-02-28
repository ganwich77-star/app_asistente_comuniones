
/**
 * Renderiza la lista de invitados en el panel de administración
 * basándose en la variable global allGuestsData.
 */
window.renderAdminList = () => {
    const adminList = document.getElementById('admin-list');
    const newGuestsBadge = document.getElementById('new-guests-badge');

    if (!adminList) return;

    // Calcular estadísticas
    let totalAdults = 0;
    let totalKids = 0;
    let newGuestsCount = 0;
    let totalMenus = { 'Carne': 0, 'Pescado': 0, 'Vegetariano': 0, 'Vegano': 0, 'SinGluten': 0, 'Infantil': 0 };

    if (allGuestsData.length === 0) {
        adminList.innerHTML = `
            <div class="text-center py-8 opacity-50">
                <span class="text-4xl block mb-2">📭</span>
                <p>No hay invitados registrados aún.</p>
            </div>`;
    } else {
        adminList.innerHTML = allGuestsData.map((guest, index) => {
            totalAdults += parseInt(guest.adultos) || 0;
            totalKids += parseInt(guest.niños) || 0;
            if (guest.status === 'unread') newGuestsCount++;

            // Contar menús
            if (guest.menu && !guest.menu.disabled) {
                Object.keys(totalMenus).forEach(k => {
                    if (guest.menu[k]) totalMenus[k] += parseInt(guest.menu[k]) || 0;
                });
            }

            // Construir resumen de menú para la tarjeta
            let menuSummary = "";
            if (guest.menu && !guest.menu.disabled) {
                menuSummary = Object.entries(guest.menu)
                    .filter(([k, v]) => v > 0)
                    .map(([k, v]) => `<span class="bg-emerald-900/40 px-2 py-0.5 rounded text-[10px] mr-1">${k}: ${v}</span>`)
                    .join('');
            } else if (guest.menu && guest.menu.disabled) {
                menuSummary = `<span class="opacity-50 text-[10px] italic">Sin menú</span>`;
            }

            const unreadClass = guest.status === 'unread' ? 'border-l-4 border-l-green-400 bg-white/10' : 'bg-white/5';
            const dateStr = guest.fecha ? new Date(guest.fecha).toLocaleDateString() : 'Fecha desconocida';

            return `
            <div class="p-4 rounded-xl border border-white/10 ${unreadClass} hover:bg-white/10 transition-colors relative group">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-emerald-100 flex-grow pr-8">${guest.nombres}</h4>
                    <span class="text-[10px] opacity-50 whitespace-nowrap">${dateStr}</span>
                </div>
                
                <div class="grid grid-cols-2 gap-2 text-xs opacity-80 mb-2">
                    <div class="flex items-center gap-1"><span>👨👩</span> <span>${guest.adultos} Adultos</span></div>
                    <div class="flex items-center gap-1"><span>👶</span> <span>${guest.niños} Niños</span></div>
                </div>

                ${menuSummary ? `<div class="mb-2 flex flex-wrap gap-1">${menuSummary}</div>` : ''}

                ${guest.comentarios ? `
                    <div class="bg-black/20 p-2 rounded text-[10px] italic text-emerald-100/80 mt-1 border-l-2 border-emerald-500/30">
                        "${guest.comentarios}"
                    </div>
                ` : ''}

                ${guest.status === 'unread' ? `
                    <button onclick="window.markGuestAsRead('${guest.id}')" 
                        class="absolute top-4 right-4 text-xs bg-green-500 text-white px-2 py-1 rounded-full shadow-lg font-bold hover:scale-110 transition-transform">
                        NUEVO
                    </button>
                ` : ''}
                
                <!-- Botón de eliminar (solo visible en modo borrado) -->
                 <div class="custom-checkbox absolute top-4 right-4 hidden delete-checkbox-container">
                    <input type="checkbox" id="del-${guest.id}" class="guest-delete-checkbox" value="${guest.id}">
                    <label for="del-${guest.id}"></label>
                </div>
            </div>
            `;
        }).join('');
    }

    // Actualizar Badges y Resúmenes
    if (newGuestsBadge) {
        newGuestsBadge.innerText = newGuestsCount;
        newGuestsBadge.classList.toggle('hidden', newGuestsCount === 0);
    }

    // Actualizar Resumen Superior
    const adminSummary = document.getElementById('admin-summary');
    if (adminSummary) {
        adminSummary.innerHTML = `
            <div class="text-center">
                <span class="block text-2xl font-bold text-white">${totalAdults + totalKids}</span>
                <span class="text-[10px] uppercase opacity-60">Total</span>
            </div>
            <div class="w-px bg-white/10"></div>
            <div class="text-center">
                <span class="block text-2xl font-bold text-emerald-200">${totalAdults}</span>
                <span class="text-[10px] uppercase opacity-60">Adultos</span>
            </div>
            <div class="text-center">
                <span class="block text-2xl font-bold text-emerald-200">${totalKids}</span>
                <span class="text-[10px] uppercase opacity-60">Niños</span>
            </div>
        `;
    }

    // Actualizar Resumen de Menús
    const mealSummary = document.getElementById('meal-summary');
    if (mealSummary) {
        // Filtrar solo los que tienen pedidos > 0
        const activeMenus = Object.entries(totalMenus).filter(([_, v]) => v > 0);

        if (activeMenus.length > 0) {
            mealSummary.innerHTML = activeMenus.map(([type, count]) => `
                <div class="bg-black/20 p-2 rounded-lg flex justify-between items-center px-4">
                    <span class="text-xs font-bold text-emerald-100/80">${type}</span>
                    <span class="text-sm font-black text-white">${count}</span>
                </div>
            `).join('');
            mealSummary.classList.remove('hidden');
        } else {
            mealSummary.innerHTML = `<p class="col-span-2 text-center text-[10px] opacity-40 italic py-2">No hay menús seleccionados</p>`;
        }
    }

    // Si estamos en modo borrado, mostrar los checkboxes
    if (window.isGuestDeleteMode) {
        document.querySelectorAll('.delete-checkbox-container').forEach(el => el.classList.remove('hidden'));
    }
};
