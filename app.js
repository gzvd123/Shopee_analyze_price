// Platform fees and risk configuration
const CONFIG = {
    fees: {
        infrastructure: { label: 'Phí hạ tầng', type: 'fixed', value: 3000 },
        piship: { label: 'PiShip', type: 'fixed', value: 1620 },
        voucherXtra: { label: 'Voucher Xtra 2.5%', type: 'percentage', value: 2.5 },
        platformFixed: { label: 'Phí cố định', type: 'percentage', value: 6.87 },
        service: { label: 'Phí dịch vụ', type: 'percentage', value: 4.14 },
        payment: { label: 'Phí thanh toán', type: 'percentage', value: 4.91 },
        affiliate: { label: 'Hoa hồng liên kết', type: 'percentage', value: 0 },
        tax: { label: 'Thuế', type: 'percentage', value: 1.5 }
    },
    risk: {
        returnRate: 3,
        returnHandlingCost: 8000
    },
    defaults: {
        packagingFee: 1500
    },
    currency: {
        exchangeRate: 4000
    }
};

// Global variables
let products = [];
let currentTab = 'single';
let importPreviewData = null;
let vouchers = [];
let currencyMode = false; // false = VND, true = CNY
let batchShippingMode = false;
let exchangeRate = CONFIG.currency.exchangeRate;
const THEME_KEY = 'pricingTheme';
let lastSingleAnalysis = null;
let dashboardSnapshot = null;
const chartInstances = {
    costDonut: null,
    profitSpark: null,
    marginBar: null
};

function applyTheme(theme = 'light') {
    document.body.dataset.theme = theme;
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        toggleBtn.textContent = theme === 'dark' ? '🌙 Giao diện tối' : '🌞 Giao diện sáng';
    }
}

function toggleTheme() {
    const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
}

function resetApplication() {
    localStorage.removeItem('pricingAnalysisData');
    localStorage.removeItem(THEME_KEY);
    window.location.reload();
}

function renderFeeConfig() {
    const container = document.getElementById('feeConfigForm');
    if (!container) return;

    const feeFields = Object.entries(CONFIG.fees).map(([key, fee]) => {
        const unit = fee.type === 'percentage' ? '%' : 'VND';
        const step = fee.type === 'percentage' ? '0.01' : '100';

        return `
            <div class="config-item">
                <label class="config-label">${fee.label}</label>
                <div class="config-input">
                    <input type="number" data-fee-key="${key}" min="0" step="${step}" value="${fee.value}">
                    <span class="config-unit">${unit}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = feeFields;

    container.querySelectorAll('input[data-fee-key]').forEach(input => {
        input.addEventListener('input', event => {
            const key = event.target.dataset.feeKey;
            if (CONFIG.fees[key]) {
                CONFIG.fees[key].value = parseFloat(event.target.value) || 0;
                calculate();
                calculateMultiProduct();
                calculateProfitAnalysis();
                updateAnalyticsDashboard();
                saveToStorage();
            }
        });
    });

    const returnRateInput = document.getElementById('returnRate');
    const returnHandlingInput = document.getElementById('returnHandling');

    returnRateInput?.addEventListener('input', event => {
        CONFIG.risk.returnRate = parseFloat(event.target.value) || 0;
        calculate();
        calculateMultiProduct();
        calculateProfitAnalysis();
        updateAnalyticsDashboard();
        saveToStorage();
    });

    returnHandlingInput?.addEventListener('input', event => {
        CONFIG.risk.returnHandlingCost = parseFloat(event.target.value) || 0;
        calculate();
        calculateMultiProduct();
        calculateProfitAnalysis();
        updateAnalyticsDashboard();
        saveToStorage();
    });
}

function syncConfigUI() {
    Object.entries(CONFIG.fees).forEach(([key, fee]) => {
        const input = document.querySelector(`input[data-fee-key="${key}"]`);
        if (input) input.value = fee.value;
    });

    const returnRateInput = document.getElementById('returnRate');
    const returnHandlingInput = document.getElementById('returnHandling');
    if (returnRateInput) returnRateInput.value = CONFIG.risk.returnRate;
    if (returnHandlingInput) returnHandlingInput.value = CONFIG.risk.returnHandlingCost;
}

function getPercentageFeeRate() {
    return Object.values(CONFIG.fees)
        .filter(fee => fee.type === 'percentage')
        .reduce((sum, fee) => sum + ((fee.value || 0) / 100), 0);
}

function getFixedFeeTotal() {
    return Object.values(CONFIG.fees)
        .filter(fee => fee.type === 'fixed')
        .reduce((sum, fee) => sum + (fee.value || 0), 0);
}

function calculatePlatformFees(sellingPrice) {
    const details = {};
    let total = 0;

    Object.entries(CONFIG.fees).forEach(([key, fee]) => {
        const value = fee.type === 'percentage'
            ? sellingPrice * ((fee.value || 0) / 100)
            : (fee.value || 0);
        details[key] = value;
        total += value;
    });

    return {
        ...details,
        total,
        percentageRate: getPercentageFeeRate(),
        fixedTotal: getFixedFeeTotal()
    };
}

function calculateRiskBuffer(sellingPrice) {
    const rate = (CONFIG.risk.returnRate || 0) / 100;
    const handling = CONFIG.risk.returnHandlingCost || 0;
    const expectedReturnLoss = sellingPrice * rate;
    const handlingProvision = handling * rate;

    return {
        expectedReturnLoss,
        handlingProvision,
        total: expectedReturnLoss + handlingProvision
    };
}

function calculateRecommendedPrice(baseCostPerUnit, profitValue, profitType) {
    const percentageRate = getPercentageFeeRate() + (CONFIG.risk.returnRate || 0) / 100;
    const fixedFees = getFixedFeeTotal() + ((CONFIG.risk.returnHandlingCost || 0) * ((CONFIG.risk.returnRate || 0) / 100));

    if (profitType === 'percentage' && profitValue > 0) {
        const profitRate = profitValue / 100;
        const denominator = 1 - percentageRate - profitRate;
        if (denominator <= 0) return 0;
        return (baseCostPerUnit + fixedFees) / denominator;
    }

    if (profitType === 'fixed' && profitValue > 0) {
        return calculatePriceForFixedProfit(baseCostPerUnit, profitValue);
    }

    return baseCostPerUnit + fixedFees;
}

// Tab switching functionality
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');

    currentTab = tabName;

    // Load data from localStorage
    loadFromStorage();

    // Recalculate based on current tab
    if (tabName === 'single') {
        calculate();
    } else if (tabName === 'multi') {
        calculateMultiProduct();
    } else if (tabName === 'profit') {
        calculateProfitAnalysis();
    } else if (tabName === 'analytics') {
        updateAnalyticsDashboard();
    }
}

// Expandable sections
function toggleSection(sectionId, evt) {
    const content = document.getElementById(sectionId);
    const header = evt?.currentTarget || evt?.target?.closest('.expandable-header');
    const icon = header?.querySelector('.expand-icon');

    if (!content || !icon) return;

    content.classList.toggle('active');
    icon.classList.toggle('rotated');
}

// Get all input elements
const inputs = {
    costPrice: document.getElementById('costPrice'),
    quantity: document.getElementById('quantity'),
    totalShipping: document.getElementById('totalShipping'),
    packagingFee: document.getElementById('packagingFee'),
    profitValue: document.getElementById('profitValue'),
    profitType: document.getElementsByName('profitType'),
    // Profit analysis inputs
    actualSellingPrice: document.getElementById('actualSellingPrice'),
    actualCostPrice: document.getElementById('actualCostPrice'),
    actualQuantity: document.getElementById('actualQuantity'),
    actualShipping: document.getElementById('actualShipping')
};

// Get result elements
const results = {
    shippingPerUnit: document.getElementById('shippingPerUnit'),
    totalCostPerUnit: document.getElementById('totalCostPerUnit'),
    recommendedPrice: document.getElementById('recommendedPrice'),
    actualProfit: document.getElementById('actualProfit'),
    profitOnCost: document.getElementById('profitOnCost'),
    breakEvenPrice: document.getElementById('breakEvenPrice'),
    costBreakdown: document.getElementById('costBreakdown')
};

// Add event listeners
Object.values(inputs).forEach(input => {
    if (input && input.length) { // Radio buttons
        input.forEach(radio => radio.addEventListener('change', () => {
            if (currentTab === 'single') calculate();
        }));
    } else if (input) {
        input.addEventListener('input', () => {
            if (currentTab === 'single') calculate();
            else if (currentTab === 'profit') calculateProfitAnalysis();
        });
    }
});

function getProfitType() {
    return Array.from(inputs.profitType).find(radio => radio.checked).value;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' VND';
}

function adjustProfitByStrategy(profitValue, profitType, strategy) {
    if (profitType === 'fixed') {
        if (strategy === 'growth') return Math.max(0, profitValue - 3000);
        if (strategy === 'premium') return profitValue + 6000;
        return profitValue;
    }

    // percentage mode
    switch (strategy) {
        case 'growth':
            return Math.max(0, profitValue - 5);
        case 'premium':
            return profitValue + 8;
        default:
            return profitValue + 2; // nhẹ nhàng boost để đảm bảo đủ biên
    }
}

function calculate() {
    const costPrice = parseFloat(inputs.costPrice.value) || 0;
    const quantity = parseInt(inputs.quantity.value) || 1;
    const totalShipping = parseFloat(inputs.totalShipping.value) || 0;
    const packagingFee = parseFloat(inputs.packagingFee.value) || CONFIG.defaults.packagingFee;
    const profitValue = parseFloat(inputs.profitValue.value) || 0;
    const profitType = getProfitType();
    const strategy = document.getElementById('pricingStrategy')?.value || 'balanced';
    const adjustedProfitValue = adjustProfitByStrategy(profitValue, profitType, strategy);

    // Calculate shipping per unit
    const shippingPerUnit = totalShipping / quantity;

    // Calculate base cost per unit
    const baseCostPerUnit = costPrice + shippingPerUnit + packagingFee;

    // Calculate recommended selling price based on profit type and config
    const recommendedPrice = calculateRecommendedPrice(baseCostPerUnit, adjustedProfitValue, profitType);

    // Calculate platform fees and risk buffers based on recommended price
    const platformFees = calculatePlatformFees(recommendedPrice);
    const riskCosts = calculateRiskBuffer(recommendedPrice);
    const totalCostPerUnit = baseCostPerUnit + platformFees.total + riskCosts.total;

    // Calculate actual profit (after risk provisioning)
    const actualProfitAmount = recommendedPrice - totalCostPerUnit;
    const actualProfitPercentage = recommendedPrice > 0 ? (actualProfitAmount / recommendedPrice) * 100 : 0;
    const profitOnCostPercentage = baseCostPerUnit > 0 ? (actualProfitAmount / baseCostPerUnit) * 100 : 0;

    // Calculate break-even price
    const breakEvenPrice = calculateBreakEvenPrice(baseCostPerUnit);

    lastSingleAnalysis = {
        costPrice,
        shippingPerUnit,
        packagingFee,
        platformFees,
        riskCosts,
        baseCostPerUnit,
        recommendedPrice,
        quantity
    };

    // Update results
    results.shippingPerUnit.textContent = formatCurrency(shippingPerUnit);
    results.totalCostPerUnit.textContent = formatCurrency(totalCostPerUnit);
    results.recommendedPrice.textContent = formatCurrency(recommendedPrice);
    results.actualProfit.textContent = `${formatCurrency(actualProfitAmount)} (${actualProfitPercentage.toFixed(1)}%)`;
    results.profitOnCost.textContent = `${profitOnCostPercentage.toFixed(1)}%`;
    results.breakEvenPrice.textContent = formatCurrency(breakEvenPrice);

    // Update cost breakdown
    updateCostBreakdown(baseCostPerUnit, platformFees, recommendedPrice, riskCosts);

    // Add animation
    document.getElementById('resultsGrid').classList.add('animate-fade-in');
    burstResultsGrid();

    // Refresh dashboard + charts
    updateAnalyticsDashboard();

    // Save to localStorage
    saveToStorage();
}

function burstResultsGrid() {
    const grid = document.getElementById('resultsGrid');
    if (!grid) return;
    grid.classList.add('burst');
    setTimeout(() => grid.classList.remove('burst'), 650);
}

function triggerCalculation() {
    showLoading('Đang tính toán & dựng biểu đồ...');

    setTimeout(() => {
        calculate();
        calculateMultiProduct();
        calculateProfitAnalysis();
        hideLoading();
    }, 320);
}
function calculatePriceForFixedProfit(baseCost, desiredProfit) {
    let low = baseCost;
    let high = baseCost + desiredProfit + 300000; // generous upper bound for convergence

    for (let i = 0; i < 80; i++) {
        const mid = (low + high) / 2;
        const platformFees = calculatePlatformFees(mid);
        const riskCosts = calculateRiskBuffer(mid);
        const totalCost = baseCost + platformFees.total + riskCosts.total;
        const profit = mid - totalCost;

        if (profit < desiredProfit) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return high;
}

function calculateBreakEvenPrice(baseCost) {
    const percentageRate = getPercentageFeeRate() + (CONFIG.risk.returnRate || 0) / 100;
    const riskFixed = (CONFIG.risk.returnHandlingCost || 0) * ((CONFIG.risk.returnRate || 0) / 100);
    const fixedPortion = getFixedFeeTotal() + riskFixed;

    const denominator = 1 - percentageRate;
    if (denominator <= 0) return 0;
    return (baseCost + fixedPortion) / denominator;
}

function updateCostBreakdown(baseCost, platformFees, sellingPrice, riskCosts) {
    const costPrice = parseFloat(inputs.costPrice.value) || 0;
    const shippingPerUnit = (parseFloat(inputs.totalShipping.value) || 0) / (parseInt(inputs.quantity.value) || 1);
    const packagingFee = parseFloat(inputs.packagingFee.value) || CONFIG.defaults.packagingFee;

    const feeDetails = Object.entries(CONFIG.fees).map(([key, fee]) => {
        const value = platformFees[key] || 0;
        const suffix = fee.type === 'percentage' ? `(${fee.value}% doanh thu)` : '(cố định)';
        return { label: `${fee.label} ${suffix}`, value };
    });

    const breakdown = [
        { label: 'Giá nhập hàng', value: costPrice },
        { label: 'Phí ship/đơn vị', value: shippingPerUnit },
        { label: 'Phí đóng gói', value: packagingFee },
        ...feeDetails,
        { label: 'Dự phòng hoàn hàng', value: riskCosts.total },
        { label: 'TỔNG CHI PHÍ', value: baseCost + platformFees.total + riskCosts.total }
    ];

    results.costBreakdown.innerHTML = breakdown.map(item =>
        `<div class="breakdown-item">
            <span>${item.label}</span>
            <span>${formatCurrency(item.value)}</span>
        </div>`
    ).join('');
}

// Multi-product functionality
function addProduct() {
    const productId = Date.now().toString();
    const product = {
        id: productId,
        name: `Sản phẩm ${products.length + 1}`,
        costPrice: 0,
        costPriceCNY: 0,
        quantity: 1,
        shippingCost: 0,
        packagingFee: CONFIG.defaults.packagingFee,
        profitMargin: 20,
        targetSellingPrice: 0,
        weight: 0,
        notes: ''
    };

    products.push(product);
    renderProductList();
    saveToStorage();
}

function removeProduct(productId) {
    products = products.filter(p => p.id !== productId);
    renderProductList();
    calculateMultiProduct();
    saveToStorage();
}

function updateProduct(productId, field, value) {
    const product = products.find(p => p.id === productId);
    if (product) {
        if (field === 'name' || field === 'notes') {
            product[field] = value;
        } else {
            product[field] = parseFloat(value) || 0;
        }

        // Handle currency conversion
        if (field === 'costPriceCNY' && currencyMode) {
            product.costPrice = product.costPriceCNY * exchangeRate;
        } else if (field === 'costPrice' && currencyMode) {
            product.costPriceCNY = product.costPrice / exchangeRate;
        }

        // Handle profit margin and target price relationship
        if (field === 'profitMargin') {
            calculateTargetPrice(productId);
        } else if (field === 'targetSellingPrice') {
            calculateProfitMargin(productId);
        }

        calculateMultiProduct();
        saveToStorage();
    }
}

function calculateTargetPrice(productId) {
    const product = products.find(p => p.id === productId);
    if (product && product.profitMargin > 0) {
        const baseCost = product.costPrice + (product.shippingCost / product.quantity) + product.packagingFee;
        const breakEvenPrice = calculateBreakEvenPrice(baseCost);
        product.targetSellingPrice = breakEvenPrice * (1 + product.profitMargin / 100);

        // Update the input field
        const targetInput = document.querySelector(`input[data-product="${productId}"][data-field="targetSellingPrice"]`);
        if (targetInput) {
            targetInput.value = Math.round(product.targetSellingPrice);
        }
    }
}

function calculateProfitMargin(productId) {
    const product = products.find(p => p.id === productId);
    if (product && product.targetSellingPrice > 0) {
        const baseCost = product.costPrice + (product.shippingCost / product.quantity) + product.packagingFee;
        const breakEvenPrice = calculateBreakEvenPrice(baseCost);

        if (breakEvenPrice > 0) {
            product.profitMargin = ((product.targetSellingPrice / breakEvenPrice) - 1) * 100;

            // Update the input field
            const marginInput = document.querySelector(`input[data-product="${productId}"][data-field="profitMargin"]`);
            if (marginInput) {
                marginInput.value = Math.round(product.profitMargin * 100) / 100;
            }
        }
    }
}

function renderProductList() {
    const container = document.getElementById('productList');
    container.innerHTML = products.map(product => {
        const costLabel = currencyMode ? 'Giá nhập (CNY):' : 'Giá nhập (VND):';
        const costValue = currencyMode ? product.costPriceCNY || 0 : product.costPrice || 0;
        const costField = currencyMode ? 'costPriceCNY' : 'costPrice';
        const shippingDisabled = batchShippingMode ? 'disabled style="background: #f8f9fa;"' : '';

        return `
        <div class="product-item">
            <div class="product-header">
                <input type="text" class="product-name" value="${product.name}"
                       onchange="updateProduct('${product.id}', 'name', this.value)"
                       style="border: none; background: transparent; font-weight: bold; font-size: 1.1rem;">
                <button class="remove-product" onclick="removeProduct('${product.id}')">🗑️ Xóa</button>
            </div>
            <div class="product-inputs">
                <div class="form-group">
                    <label>${costLabel}</label>
                    <input type="number" value="${costValue}" min="0"
                           onchange="updateProduct('${product.id}', '${costField}', this.value)">
                    ${currencyMode ? `<div class="currency-info">≈ ${formatCurrency(product.costPrice)}</div>` : ''}
                </div>
                <div class="form-group">
                    <label>Số lượng:</label>
                    <input type="number" value="${product.quantity}" min="1"
                           onchange="updateProduct('${product.id}', 'quantity', this.value)">
                </div>
                <div class="form-group">
                    <label>Phí ship (VND):</label>
                    <input type="number" value="${product.shippingCost}" min="0" ${shippingDisabled}
                           onchange="updateProduct('${product.id}', 'shippingCost', this.value)">
                    ${batchShippingMode ? '<div class="currency-info">Tự động tính từ phí ship lô</div>' : ''}
                </div>
                <div class="form-group">
                    <label>Phí đóng gói (VND):</label>
                    <input type="number" value="${product.packagingFee}" min="0"
                           onchange="updateProduct('${product.id}', 'packagingFee', this.value)">
                </div>
                <div class="form-group linked-inputs">
                    <label>Tỷ suất LN mong muốn (%):</label>
                    <input type="number" value="${product.profitMargin}" min="0" step="0.1"
                           data-product="${product.id}" data-field="profitMargin"
                           onchange="updateProduct('${product.id}', 'profitMargin', this.value)">
                </div>
                <div class="form-group">
                    <label>Giá bán mục tiêu (VND):</label>
                    <input type="number" value="${product.targetSellingPrice}" min="0"
                           data-product="${product.id}" data-field="targetSellingPrice"
                           onchange="updateProduct('${product.id}', 'targetSellingPrice', this.value)">
                </div>
                ${batchShippingMode ? `
                <div class="form-group">
                    <label>Trọng lượng (kg) - tùy chọn:</label>
                    <input type="number" value="${product.weight || 0}" min="0" step="0.1"
                           onchange="updateProduct('${product.id}', 'weight', this.value)">
                </div>` : ''}
                <div class="form-group">
                    <label>Ghi chú:</label>
                    <input type="text" value="${product.notes || ''}"
                           onchange="updateProduct('${product.id}', 'notes', this.value)"
                           placeholder="Thông tin bổ sung...">
                </div>
            </div>
        </div>
    `;
    }).join('');
}
function calculateMultiProduct() {
    if (products.length === 0) {
        document.getElementById('totalOrderValue').textContent = '0 VND';
        document.getElementById('totalProfit').textContent = '0 VND';
        document.getElementById('totalCost').textContent = '0 VND';
        document.getElementById('avgProfitMargin').textContent = '0%';
        document.getElementById('appliedVoucher').innerHTML = '';
        updateAnalyticsDashboard();
        return;
    }

    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    const productResults = [];

    products.forEach(product => {
        const baseCost = product.costPrice + (product.shippingCost / product.quantity) + product.packagingFee;

        // Use target selling price if set, otherwise calculate from profit margin
        let recommendedPrice;
        if (product.targetSellingPrice > 0) {
            recommendedPrice = product.targetSellingPrice;
        } else {
            const breakEvenPrice = calculateBreakEvenPrice(baseCost);
            const profitMultiplier = 1 + (product.profitMargin || 20) / 100;
            recommendedPrice = breakEvenPrice * profitMultiplier;
        }

        const platformFees = calculatePlatformFees(recommendedPrice);
        const riskCosts = calculateRiskBuffer(recommendedPrice);
        const totalProductCost = baseCost + platformFees.total + riskCosts.total;
        const productProfit = recommendedPrice - totalProductCost;
        const productRevenue = recommendedPrice * product.quantity;

        totalRevenue += productRevenue;
        totalCost += totalProductCost * product.quantity;
        totalProfit += productProfit * product.quantity;

        productResults.push({
            name: product.name,
            cost: totalProductCost,
            price: recommendedPrice,
            profit: productProfit,
            profitMargin: recommendedPrice > 0 ? (productProfit / recommendedPrice) * 100 : 0,
            quantity: product.quantity
        });
    });

    // Apply voucher discount
    const voucherResult = findBestVoucher(totalRevenue);
    let finalRevenue = totalRevenue;
    let voucherDiscount = 0;

    if (voucherResult.voucher) {
        voucherDiscount = voucherResult.discount;
        finalRevenue = totalRevenue - voucherDiscount;
        totalProfit -= voucherDiscount;

        // Update voucher display
        document.getElementById('appliedVoucher').innerHTML = `
            <div class="voucher-item voucher-active">
                <div>
                    <strong>✅ Voucher được áp dụng: ${voucherResult.voucher.description}</strong><br>
                    <small>Giảm ${formatCurrency(voucherDiscount)} cho đơn hàng này</small>
                </div>
            </div>
        `;
    } else {
        document.getElementById('appliedVoucher').innerHTML = '';
    }

    const avgProfitMargin = finalRevenue > 0 ? (totalProfit / finalRevenue) * 100 : 0;

    // Update multi-product results
    document.getElementById('totalOrderValue').textContent = formatCurrency(finalRevenue);
    document.getElementById('totalProfit').textContent = formatCurrency(totalProfit);
    document.getElementById('totalCost').textContent = formatCurrency(totalCost);
    document.getElementById('avgProfitMargin').textContent = avgProfitMargin.toFixed(1) + '%';

    // Update product comparison table
    const tableBody = document.querySelector('#productComparisonTable tbody');
    tableBody.innerHTML = productResults.map(result => `
        <tr>
            <td>${result.name}</td>
            <td>${formatCurrency(result.cost)}</td>
            <td>${formatCurrency(result.price)}</td>
            <td>${formatCurrency(result.profit)}</td>
            <td>${result.profitMargin.toFixed(1)}%</td>
            <td>${result.quantity}</td>
        </tr>
    `).join('');

    updateAnalyticsDashboard();
}

// Profit analysis functionality
function calculateProfitAnalysis() {
    const sellingPrice = parseFloat(inputs.actualSellingPrice.value) || 0;
    const costPrice = parseFloat(inputs.actualCostPrice.value) || 0;
    const quantity = parseInt(inputs.actualQuantity.value) || 1;
    const shippingCost = parseFloat(inputs.actualShipping.value) || 0;

    if (sellingPrice === 0 || costPrice === 0) {
        // Reset all values if no input
        document.getElementById('profitOnRevenue').textContent = '0% (0 VND)';
        document.getElementById('profitOnCostActual').textContent = '0% (0 VND)';
        document.getElementById('roi').textContent = '0%';
        document.getElementById('profitPerUnit').textContent = '0 VND';
        document.getElementById('profitPerBatch').textContent = '0 VND';
        document.getElementById('totalRevenue').textContent = '0 VND';
        return;
    }

    const platformFees = calculatePlatformFees(sellingPrice);
    const riskCosts = calculateRiskBuffer(sellingPrice);
    const totalCostPerUnit = costPrice + (shippingCost / quantity) + CONFIG.defaults.packagingFee + platformFees.total + riskCosts.total;
    const profitPerUnit = sellingPrice - totalCostPerUnit;
    const profitPerBatch = profitPerUnit * quantity;
    const totalRevenue = sellingPrice * quantity;
    const totalInvestment = costPrice * quantity + shippingCost;

    // Calculate margins
    const profitOnRevenue = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;
    const profitOnCost = costPrice > 0 ? (profitPerUnit / costPrice) * 100 : 0;
    const roi = totalInvestment > 0 ? (profitPerBatch / totalInvestment) * 100 : 0;

    // Update profit analysis results
    document.getElementById('profitOnRevenue').textContent = `${profitOnRevenue.toFixed(1)}% (${formatCurrency(profitPerUnit)})`;
    document.getElementById('profitOnCostActual').textContent = `${profitOnCost.toFixed(1)}% (${formatCurrency(profitPerUnit)})`;
    document.getElementById('roi').textContent = `${roi.toFixed(1)}%`;
    document.getElementById('profitPerUnit').textContent = formatCurrency(profitPerUnit);
    document.getElementById('profitPerBatch').textContent = formatCurrency(profitPerBatch);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);

    // Update comparison metrics
    updateComparisonMetrics(sellingPrice, costPrice, profitPerUnit, profitOnRevenue);
}

function updateComparisonMetrics(actualPrice, actualCost, actualProfit, actualMargin) {
    // Get projected values from single product analysis
    const projectedCost = parseFloat(inputs.costPrice.value) || 0;
    const projectedPrice = parseFloat(document.getElementById('recommendedPrice').textContent.replace(/[^\d]/g, '')) || 0;

    const comparisonHTML = `
        <div class="metric-row">
            <span class="metric-label">Giá bán dự kiến vs thực tế:</span>
            <span class="metric-value">${formatCurrency(projectedPrice)} vs ${formatCurrency(actualPrice)}</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Chi phí dự kiến vs thực tế:</span>
            <span class="metric-value">${formatCurrency(projectedCost)} vs ${formatCurrency(actualCost)}</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Chênh lệch giá bán:</span>
            <span class="metric-value">${formatCurrency(actualPrice - projectedPrice)}</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Hiệu suất thực tế:</span>
            <span class="metric-value">${actualMargin.toFixed(1)}%</span>
        </div>
    `;

    document.getElementById('comparisonMetrics').innerHTML = comparisonHTML;
}

// Analytics dashboard
function aggregateMetrics() {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    const costComponents = { cost: 0, shipping: 0, packaging: 0, fees: 0, risk: 0 };
    let bestMargin = 0;

    // Add single product data if available
    const singleCost = parseFloat(inputs.costPrice.value) || 0;
    const singleQuantity = parseInt(inputs.quantity.value) || 1;
    const singleShipping = parseFloat(inputs.totalShipping.value) || 0;
    const singlePackaging = parseFloat(inputs.packagingFee.value) || CONFIG.defaults.packagingFee;
    const desiredProfit = parseFloat(inputs.profitValue.value) || 0;
    const strategy = document.getElementById('pricingStrategy')?.value || 'balanced';

    if (singleCost > 0) {
        const baseCost = singleCost + (singleShipping / singleQuantity) + singlePackaging;
        const adjustedProfit = adjustProfitByStrategy(desiredProfit, getProfitType(), strategy);
        const recommended = calculateRecommendedPrice(baseCost, adjustedProfit, getProfitType());
        const fees = calculatePlatformFees(recommended);
        const risk = calculateRiskBuffer(recommended);
        const unitCost = baseCost + fees.total + risk.total;

        const revenue = recommended * singleQuantity;
        const cost = unitCost * singleQuantity;
        const profit = revenue - cost;

        totalRevenue += revenue;
        totalCost += cost;
        totalProfit += profit;

        costComponents.cost += singleCost * singleQuantity;
        costComponents.shipping += singleShipping;
        costComponents.packaging += singlePackaging * singleQuantity;
        costComponents.fees += fees.total * singleQuantity;
        costComponents.risk += risk.total * singleQuantity;

        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        bestMargin = Math.max(bestMargin, margin);
    }

    // Add multi-product data
    products.forEach(product => {
        if (!product.quantity) return;

        const baseCost = product.costPrice + (product.shippingCost / product.quantity) + product.packagingFee;
        const breakEven = calculateBreakEvenPrice(baseCost);
        const sellingPrice = product.targetSellingPrice > 0
            ? product.targetSellingPrice
            : breakEven * (1 + (product.profitMargin || 0) / 100);
        const fees = calculatePlatformFees(sellingPrice);
        const risk = calculateRiskBuffer(sellingPrice);
        const unitCost = baseCost + fees.total + risk.total;

        const revenue = sellingPrice * product.quantity;
        const cost = unitCost * product.quantity;
        const profit = revenue - cost;

        totalRevenue += revenue;
        totalCost += cost;
        totalProfit += profit;

        costComponents.cost += product.costPrice * product.quantity;
        costComponents.shipping += product.shippingCost;
        costComponents.packaging += product.packagingFee * product.quantity;
        costComponents.fees += fees.total * product.quantity;
        costComponents.risk += risk.total * product.quantity;

        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        bestMargin = Math.max(bestMargin, margin);
    });

    const voucherSnapshot = findBestVoucher(totalRevenue);
    if (voucherSnapshot.voucher) {
        totalRevenue -= voucherSnapshot.discount;
        totalProfit -= voucherSnapshot.discount;
    }

    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCost, totalProfit, avgMargin, costComponents, bestMargin };
}

function updateAnalyticsDashboard() {
    dashboardSnapshot = aggregateMetrics();
    const snapshot = dashboardSnapshot;

    document.getElementById('dashTotalRevenue').textContent = formatCurrency(snapshot.totalRevenue);
    document.getElementById('dashTotalCost').textContent = formatCurrency(snapshot.totalCost);
    document.getElementById('dashTotalProfit').textContent = formatCurrency(snapshot.totalProfit);
    document.getElementById('dashAvgMargin').textContent = snapshot.avgMargin.toFixed(1) + '%';

    updateCostStructureAnalysis(snapshot.totalCost, snapshot.totalRevenue);
    updateProfitDistributionAnalysis(snapshot.totalProfit, snapshot.totalRevenue);
    updateCharts(snapshot);
}

function updateCostStructureAnalysis(totalCost, totalRevenue) {
    const costRatio = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
    const profitRatio = 100 - costRatio;

    const analysisHTML = `
        <div class="metric-row">
            <span class="metric-label">Tỷ lệ chi phí/doanh thu:</span>
            <span class="metric-value">${costRatio.toFixed(1)}%</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Tỷ lệ lợi nhuận/doanh thu:</span>
            <span class="metric-value">${profitRatio.toFixed(1)}%</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Hiệu quả chi phí:</span>
            <span class="metric-value">${totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : 0}x</span>
        </div>
    `;

    document.getElementById('costStructureAnalysis').innerHTML = analysisHTML;
}

function updateProfitDistributionAnalysis(totalProfit, totalRevenue) {
    const profitPercentage = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const analysisHTML = `
        <div class="metric-row">
            <span class="metric-label">Tổng lợi nhuận:</span>
            <span class="metric-value">${formatCurrency(totalProfit)}</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Tỷ suất lợi nhuận:</span>
            <span class="metric-value">${profitPercentage.toFixed(1)}%</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Lợi nhuận trên doanh thu:</span>
            <span class="metric-value">${profitPercentage.toFixed(1)}%</span>
        </div>
    `;

    document.getElementById('profitDistributionAnalysis').innerHTML = analysisHTML;
}

function updateCharts(snapshot) {
    if (!snapshot) return;

    const palette = ['#6b8cff', '#14b8a6', '#f97316', '#0ea5e9', '#a855f7'];

    // Cost donut
    const donutCtx = document.getElementById('costDonutChart');
    if (donutCtx) {
        const labels = ['Giá nhập', 'Vận chuyển', 'Đóng gói', 'Phí nền tảng', 'Dự phòng rủi ro'];
        const data = [
            snapshot.costComponents.cost,
            snapshot.costComponents.shipping,
            snapshot.costComponents.packaging,
            snapshot.costComponents.fees,
            snapshot.costComponents.risk
        ];

        if (!chartInstances.costDonut) {
            chartInstances.costDonut = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: palette,
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '58%',
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${labels[ctx.dataIndex]}: ${formatCurrency(ctx.parsed)}`
                            }
                        }
                    },
                    animation: { duration: 600, easing: 'easeOutQuart' }
                }
            });
        } else {
            chartInstances.costDonut.data.datasets[0].data = data;
            chartInstances.costDonut.update();
        }
    }

    // Profit sparkline
    const sparkCtx = document.getElementById('profitSparkChart');
    if (sparkCtx) {
        const labels = ['Khởi tạo', 'Hiện tại'];
        const revenueSeries = [0, snapshot.totalRevenue];
        const costSeries = [0, snapshot.totalCost];
        const profitSeries = [0, snapshot.totalProfit];

        if (!chartInstances.profitSpark) {
            chartInstances.profitSpark = new Chart(sparkCtx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Doanh thu', data: revenueSeries, borderColor: palette[1], tension: 0.35, fill: false },
                        { label: 'Chi phí', data: costSeries, borderColor: palette[0], tension: 0.35, fill: false },
                        { label: 'Lợi nhuận', data: profitSeries, borderColor: palette[2], tension: 0.35, fill: false }
                    ]
                },
                options: {
                    plugins: {
                        legend: { display: true },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y || ctx.parsed)}`
                            }
                        }
                    },
                    scales: { y: { ticks: { callback: value => value.toLocaleString('vi-VN') } } },
                    interaction: { mode: 'index', intersect: false }
                }
            });
        } else {
            chartInstances.profitSpark.data.datasets[0].data = revenueSeries;
            chartInstances.profitSpark.data.datasets[1].data = costSeries;
            chartInstances.profitSpark.data.datasets[2].data = profitSeries;
            chartInstances.profitSpark.update();
        }
    }

    // Margin bar chart
    const marginCtx = document.getElementById('marginBarChart');
    if (marginCtx) {
        const labels = ['Biên thực tế', 'Mục tiêu 25%', 'Sản phẩm tốt nhất'];
        const data = [snapshot.avgMargin, 25, snapshot.bestMargin || snapshot.avgMargin];

        if (!chartInstances.marginBar) {
            chartInstances.marginBar = new Chart(marginCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: [palette[1], palette[3], palette[2]],
                        borderRadius: 8
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${labels[ctx.dataIndex]}: ${ctx.parsed.y.toFixed(1)}%`
                            }
                        }
                    },
                    scales: {
                        y: {
                            suggestedMax: Math.max(30, snapshot.bestMargin + 5),
                            ticks: { callback: value => value + '%' }
                        }
                    }
                }
            });
        } else {
            chartInstances.marginBar.data.datasets[0].data = data;
            chartInstances.marginBar.options.scales.y.suggestedMax = Math.max(30, snapshot.bestMargin + 5);
            chartInstances.marginBar.update();
        }
    }
}

// Local storage functions
function saveToStorage() {
    const data = {
        singleProduct: {
            costPrice: inputs.costPrice.value,
            quantity: inputs.quantity.value,
            totalShipping: inputs.totalShipping.value,
            packagingFee: inputs.packagingFee.value,
            profitValue: inputs.profitValue.value,
            profitType: getProfitType(),
            pricingStrategy: document.getElementById('pricingStrategy')?.value || 'balanced'
        },
        products: products,
        vouchers: vouchers,
        settings: {
            currencyMode: currencyMode,
            batchShippingMode: batchShippingMode,
            exchangeRate: exchangeRate,
            theme: document.body.dataset.theme || 'light'
        },
        config: {
            fees: CONFIG.fees,
            risk: CONFIG.risk,
            defaults: CONFIG.defaults,
            currency: CONFIG.currency
        },
        profitAnalysis: {
            actualSellingPrice: inputs.actualSellingPrice?.value || '',
            actualCostPrice: inputs.actualCostPrice?.value || '',
            actualQuantity: inputs.actualQuantity?.value || '',
            actualShipping: inputs.actualShipping?.value || ''
        }
    };

    localStorage.setItem('pricingAnalysisData', JSON.stringify(data));
}

function loadFromStorage() {
    const savedData = localStorage.getItem('pricingAnalysisData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);

            // Load config
            if (data.config) {
                if (data.config.fees) {
                    Object.entries(CONFIG.fees).forEach(([key, fee]) => {
                        if (data.config.fees[key]?.value !== undefined) {
                            fee.value = data.config.fees[key].value;
                        }
                    });
                }

                if (data.config.risk) {
                    CONFIG.risk.returnRate = data.config.risk.returnRate ?? CONFIG.risk.returnRate;
                    CONFIG.risk.returnHandlingCost = data.config.risk.returnHandlingCost ?? CONFIG.risk.returnHandlingCost;
                }

                if (data.config.defaults?.packagingFee) {
                    CONFIG.defaults.packagingFee = data.config.defaults.packagingFee;
                }

                if (data.config.currency?.exchangeRate) {
                    CONFIG.currency.exchangeRate = data.config.currency.exchangeRate;
                    exchangeRate = CONFIG.currency.exchangeRate;
                }

                syncConfigUI();
            }

            // Load single product data
            if (data.singleProduct) {
                inputs.costPrice.value = data.singleProduct.costPrice || '';
                inputs.quantity.value = data.singleProduct.quantity || '1';
                inputs.totalShipping.value = data.singleProduct.totalShipping || '';
                inputs.packagingFee.value = data.singleProduct.packagingFee || CONFIG.defaults.packagingFee || '1500';
                inputs.profitValue.value = data.singleProduct.profitValue || '';

                // Set profit type
                const profitTypeRadios = document.getElementsByName('profitType');
                profitTypeRadios.forEach(radio => {
                    radio.checked = radio.value === data.singleProduct.profitType;
                });

                const strategySelect = document.getElementById('pricingStrategy');
                if (strategySelect && data.singleProduct.pricingStrategy) {
                    strategySelect.value = data.singleProduct.pricingStrategy;
                }
            }

            // Load multi-product data
            if (data.products) {
                products = data.products;
                renderProductList();
            }

            // Load vouchers
            if (data.vouchers) {
                vouchers = data.vouchers;
                renderVoucherList();
            }

            // Load settings
            if (data.settings) {
                currencyMode = data.settings.currencyMode || false;
                batchShippingMode = data.settings.batchShippingMode || false;
                exchangeRate = data.settings.exchangeRate || 4000;
                const preferredTheme = data.settings.theme || localStorage.getItem(THEME_KEY) || 'light';
                applyTheme(preferredTheme);
                localStorage.setItem(THEME_KEY, preferredTheme);

                // Update UI
                document.getElementById('currencyMode').checked = currencyMode;
                document.getElementById('batchShippingMode').checked = batchShippingMode;
                document.getElementById('exchangeRate').value = exchangeRate;
                document.getElementById('currencyLabel').textContent = currencyMode ? 'CNY' : 'VND';
                document.getElementById('currencySettings').style.display = currencyMode ? 'block' : 'none';
                document.getElementById('batchShippingSettings').style.display = batchShippingMode ? 'block' : 'none';
                document.getElementById('exchangeDisplay').textContent = exchangeRate.toLocaleString('vi-VN');
            }

            // Load profit analysis data
            if (data.profitAnalysis && inputs.actualSellingPrice) {
                inputs.actualSellingPrice.value = data.profitAnalysis.actualSellingPrice || '';
                inputs.actualCostPrice.value = data.profitAnalysis.actualCostPrice || '';
                inputs.actualQuantity.value = data.profitAnalysis.actualQuantity || '1';
                inputs.actualShipping.value = data.profitAnalysis.actualShipping || '';
            }
        } catch (e) {
            console.error('Error loading saved data:', e);
        }
    }
}

// Initialize the application
function init() {
    applyTheme(localStorage.getItem(THEME_KEY) || 'light');
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    document.getElementById('resetApp')?.addEventListener('click', resetApplication);
    document.getElementById('calculateBtn')?.addEventListener('click', triggerCalculation);

    renderFeeConfig();
    loadFromStorage();
    syncConfigUI();

    if (inputs.packagingFee && !inputs.packagingFee.value) {
        inputs.packagingFee.value = CONFIG.defaults.packagingFee;
    }

    calculate();
    calculateMultiProduct();
    calculateProfitAnalysis();
    updateAnalyticsDashboard();
}

// Excel Integration Functions
function showLoading(text = 'Đang xử lý...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showMessage(message, type = 'success') {
    const messagesDiv = document.getElementById('importMessages');
    const messageClass = type === 'error' ? 'error-message' : 'success-message';
    messagesDiv.innerHTML = `<div class="${messageClass}">${message}</div>`;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        messagesDiv.innerHTML = '';
    }, 5000);
}

function downloadTemplate() {
    showLoading('Đang tạo mẫu Excel...');

    try {
        // Create workbook
        const wb = XLSX.utils.book_new();

        // Create template sheet with enhanced fields
        const templateData = [
            ['Tên sản phẩm', 'Giá nhập (VND)', 'Giá nhập (CNY)', 'Số lượng', 'Phí ship (VND)', 'Phí đóng gói (VND)', 'Tỷ suất LN (%)', 'Giá bán mục tiêu (VND)', 'Trọng lượng (kg)', 'Ghi chú'],
            ['Sản phẩm mẫu 1', 50000, 13.33, 10, 15000, 1500, 20, 75000, 0.5, 'Ví dụ sản phẩm'],
            ['Sản phẩm mẫu 2', 75000, 20, 5, 20000, 1500, 25, 110000, 1.2, 'Ví dụ sản phẩm khác'],
            ['', '', '', '', '', 1500, 20, '', '', 'Nhập dữ liệu của bạn từ dòng này']
        ];

        const ws = XLSX.utils.aoa_to_sheet(templateData);

        // Set column widths
        ws['!cols'] = [
            { width: 25 }, // Tên sản phẩm
            { width: 18 }, // Giá nhập VND
            { width: 15 }, // Giá nhập CNY
            { width: 12 }, // Số lượng
            { width: 18 }, // Phí ship
            { width: 18 }, // Phí đóng gói
            { width: 15 }, // Tỷ suất LN
            { width: 20 }, // Giá bán mục tiêu
            { width: 15 }, // Trọng lượng
            { width: 30 }  // Ghi chú
        ];

        // Style header row
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4FACFE" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        // Apply header styling
        for (let col = 0; col < 10; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!ws[cellRef]) ws[cellRef] = {};
            ws[cellRef].s = headerStyle;
        }

        XLSX.utils.book_append_sheet(wb, ws, 'Danh sách sản phẩm');

        // Create instructions sheet
        const instructionsData = [
            ['HƯỚNG DẪN SỬ DỤNG MẪU EXCEL'],
            [''],
            ['1. CÁC CỘT THÔNG TIN:'],
            ['   • Tên sản phẩm: Nhập tên sản phẩm (bắt buộc)'],
            ['   • Giá nhập VND: Nhập giá nhập bằng VND (bắt buộc nếu không dùng CNY)'],
            ['   • Giá nhập CNY: Nhập giá nhập bằng CNY (tùy chọn, sẽ tự động chuyển đổi)'],
            ['   • Số lượng: Nhập số lượng sản phẩm (bắt buộc, số nguyên dương)'],
            ['   • Phí ship: Phí vận chuyển riêng cho sản phẩm này (VND)'],
            ['   • Phí đóng gói: Phí đóng gói (mặc định 1500 VND)'],
            ['   • Tỷ suất LN: Tỷ suất lợi nhuận mong muốn (%, mặc định 20%)'],
            ['   • Giá bán mục tiêu: Giá bán mục tiêu (VND, tùy chọn)'],
            ['   • Trọng lượng: Trọng lượng sản phẩm (kg, dùng cho phân bổ ship)'],
            ['   • Ghi chú: Thông tin bổ sung (tùy chọn)'],
            [''],
            ['2. QUY TẮC NHẬP LIỆU:'],
            ['   • Không được để trống tên sản phẩm'],
            ['   • Giá nhập hàng và số lượng phải là số dương'],
            ['   • Phí ship và phí đóng gói có thể để trống (sẽ dùng giá trị 0)'],
            ['   • Xóa các dòng mẫu trước khi nhập dữ liệu thật'],
            [''],
            ['3. CÁCH SỬ DỤNG:'],
            ['   • Tải mẫu này về máy tính'],
            ['   • Nhập dữ liệu sản phẩm vào sheet "Danh sách sản phẩm"'],
            ['   • Lưu file với định dạng .xlsx'],
            ['   • Quay lại web tool và chọn "Import từ Excel"'],
            ['   • Chọn file đã lưu và xác nhận import'],
            [''],
            ['4. LƯU Ý:'],
            ['   • File phải có định dạng .xlsx hoặc .xls'],
            ['   • Không thay đổi tên các cột header'],
            ['   • Tối đa 1000 sản phẩm mỗi lần import'],
            ['   • Dữ liệu sẽ được tự động tính toán sau khi import']
        ];

        const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
        instructionsWs['!cols'] = [{ width: 80 }];

        // Style instructions header
        if (instructionsWs['A1']) {
            instructionsWs['A1'].s = {
                font: { bold: true, size: 14, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "28A745" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }

        XLSX.utils.book_append_sheet(wb, instructionsWs, 'Hướng dẫn');

        // Generate and download file
        const fileName = `Mau_Phan_Tich_Gia_San_Pham_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        hideLoading();
        showMessage('✅ Đã tải xuống mẫu Excel thành công!', 'success');

    } catch (error) {
        hideLoading();
        showMessage('❌ Lỗi khi tạo mẫu Excel: ' + error.message, 'error');
        console.error('Template download error:', error);
    }
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading('Đang đọc file Excel...');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Get first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                throw new Error('File Excel không có dữ liệu hoặc chỉ có header');
            }

            // Validate and parse data
            const parsedData = parseExcelData(jsonData);

            if (parsedData.length === 0) {
                throw new Error('Không tìm thấy dữ liệu hợp lệ trong file Excel');
            }

            // Store preview data and show preview
            importPreviewData = parsedData;
            showImportPreview(parsedData);

            hideLoading();

        } catch (error) {
            hideLoading();
            showMessage('❌ Lỗi khi đọc file Excel: ' + error.message, 'error');
            console.error('Excel import error:', error);
        }
    };

    reader.readAsArrayBuffer(file);
}

function parseExcelData(jsonData) {
    const headers = jsonData[0];
    const dataRows = jsonData.slice(1);
    const parsedData = [];
    const errors = [];

    // Expected column indices (flexible order)
    const columnMap = {};
    headers.forEach((header, index) => {
        const normalizedHeader = header?.toString().toLowerCase().trim();
        if (normalizedHeader.includes('tên') || normalizedHeader.includes('name')) {
            columnMap.name = index;
        } else if (normalizedHeader.includes('giá nhập') && normalizedHeader.includes('vnd')) {
            columnMap.costPrice = index;
        } else if (normalizedHeader.includes('giá nhập') && normalizedHeader.includes('cny')) {
            columnMap.costPriceCNY = index;
        } else if (normalizedHeader.includes('số lượng') || normalizedHeader.includes('quantity')) {
            columnMap.quantity = index;
        } else if (normalizedHeader.includes('ship') || normalizedHeader.includes('vận chuyển')) {
            columnMap.shipping = index;
        } else if (normalizedHeader.includes('đóng gói') || normalizedHeader.includes('packaging')) {
            columnMap.packaging = index;
        } else if (normalizedHeader.includes('tỷ suất') || normalizedHeader.includes('lợi nhuận') && normalizedHeader.includes('%')) {
            columnMap.profitMargin = index;
        } else if (normalizedHeader.includes('giá bán') || normalizedHeader.includes('mục tiêu')) {
            columnMap.targetPrice = index;
        } else if (normalizedHeader.includes('trọng lượng') || normalizedHeader.includes('weight')) {
            columnMap.weight = index;
        } else if (normalizedHeader.includes('ghi chú') || normalizedHeader.includes('note')) {
            columnMap.notes = index;
        }
    });

    // Validate required columns
    if (columnMap.name === undefined || columnMap.costPrice === undefined || columnMap.quantity === undefined) {
        throw new Error('File Excel thiếu các cột bắt buộc: Tên sản phẩm, Giá nhập hàng, Số lượng');
    }

    dataRows.forEach((row, index) => {
        const rowNumber = index + 2; // +2 because of header and 0-based index

        // Skip empty rows
        if (!row || row.every(cell => !cell && cell !== 0)) {
            return;
        }

        const name = row[columnMap.name]?.toString().trim();
        const costPrice = parseFloat(row[columnMap.costPrice]) || 0;
        const costPriceCNY = parseFloat(row[columnMap.costPriceCNY]) || 0;
        const quantity = parseInt(row[columnMap.quantity]) || 0;
        const shipping = parseFloat(row[columnMap.shipping]) || 0;
        const packaging = parseFloat(row[columnMap.packaging]) || CONFIG.defaults.packagingFee;
        const profitMargin = parseFloat(row[columnMap.profitMargin]) || 20;
        const targetPrice = parseFloat(row[columnMap.targetPrice]) || 0;
        const weight = parseFloat(row[columnMap.weight]) || 0;
        const notes = row[columnMap.notes]?.toString().trim() || '';

        // Validate required fields
        if (!name) {
            errors.push(`Dòng ${rowNumber}: Thiếu tên sản phẩm`);
            return;
        }

        // Either VND or CNY price must be provided
        if (costPrice <= 0 && costPriceCNY <= 0) {
            errors.push(`Dòng ${rowNumber}: Phải có giá nhập (VND hoặc CNY) lớn hơn 0`);
            return;
        }

        if (quantity <= 0) {
            errors.push(`Dòng ${rowNumber}: Số lượng phải lớn hơn 0`);
            return;
        }

        // Calculate VND price if only CNY is provided
        let finalCostPrice = costPrice;
        let finalCostPriceCNY = costPriceCNY;

        if (costPrice <= 0 && costPriceCNY > 0) {
            finalCostPrice = costPriceCNY * exchangeRate;
        } else if (costPrice > 0 && costPriceCNY <= 0) {
            finalCostPriceCNY = costPrice / exchangeRate;
        }

        parsedData.push({
            id: Date.now().toString() + '_' + index,
            name: name,
            costPrice: finalCostPrice,
            costPriceCNY: finalCostPriceCNY,
            quantity: quantity,
            shippingCost: shipping,
            packagingFee: packaging,
            profitMargin: profitMargin,
            targetSellingPrice: targetPrice,
            weight: weight,
            notes: notes
        });
    });

    if (errors.length > 0) {
        throw new Error('Lỗi dữ liệu:\n' + errors.join('\n'));
    }

    return parsedData;
}
function showImportPreview(data) {
    const previewDiv = document.getElementById('importPreview');
    const previewContent = document.getElementById('previewContent');

    if (data.length === 0) {
        previewContent.innerHTML = '<p>Không có dữ liệu để hiển thị</p>';
        return;
    }

    // Create preview table
    let tableHTML = `
        <table class="preview-table">
            <thead>
                <tr>
                    <th>Tên sản phẩm</th>
                    <th>Giá nhập (VND)</th>
                    <th>Số lượng</th>
                    <th>Phí ship (VND)</th>
                    <th>Phí đóng gói (VND)</th>
                    <th>Ghi chú</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Show first 10 rows for preview
    const previewRows = data.slice(0, 10);
    previewRows.forEach(item => {
        tableHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${formatCurrency(item.costPrice)}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.shippingCost)}</td>
                <td>${formatCurrency(item.packagingFee)}</td>
                <td>${item.notes}</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';

    if (data.length > 10) {
        tableHTML += `<p style="margin-top: 10px; font-style: italic; color: #666;">
            Hiển thị 10/${data.length} sản phẩm. Tất cả sẽ được import khi xác nhận.
        </p>`;
    }

    previewContent.innerHTML = tableHTML;
    previewDiv.style.display = 'block';
}

function confirmImport() {
    if (!importPreviewData) {
        showMessage('❌ Không có dữ liệu để import', 'error');
        return;
    }

    showLoading('Đang import dữ liệu...');

    try {
        const importMode = document.querySelector('input[name="importMode"]:checked').value;

        if (importMode === 'replace') {
            products = [...importPreviewData];
        } else {
            // Merge mode - add to existing products
            products = [...products, ...importPreviewData];
        }

        // Clear preview
        cancelImport();

        // Re-render product list and recalculate
        renderProductList();
        calculateMultiProduct();
        saveToStorage();

        hideLoading();
        showMessage(`✅ Đã import thành công ${importPreviewData.length} sản phẩm!`, 'success');

        // Clear file input
        document.getElementById('excelFileInput').value = '';

    } catch (error) {
        hideLoading();
        showMessage('❌ Lỗi khi import dữ liệu: ' + error.message, 'error');
        console.error('Import confirmation error:', error);
    }
}

function cancelImport() {
    document.getElementById('importPreview').style.display = 'none';
    importPreviewData = null;
    document.getElementById('excelFileInput').value = '';
}

function exportToExcel() {
    showLoading('Đang tạo file Excel...');

    try {
        const wb = XLSX.utils.book_new();

        // Prepare product data with calculations
        const exportData = [
            ['Tên sản phẩm', 'Giá nhập (VND)', 'Số lượng', 'Phí ship (VND)', 'Phí đóng gói (VND)',
             'Giá bán đề xuất (VND)', 'Lợi nhuận/đơn vị (VND)', 'Tỷ suất LN (%)', 'Tổng doanh thu (VND)', 'Ghi chú']
        ];

        let totalRevenue = 0;
        let totalCost = 0;
        let totalProfit = 0;

        products.forEach(product => {
            const baseCost = product.costPrice + (product.shippingCost / product.quantity) + product.packagingFee;
            const breakEvenPrice = calculateBreakEvenPrice(baseCost);
            const recommendedPrice = breakEvenPrice * 1.2; // 20% profit margin
            const platformFees = calculatePlatformFees(recommendedPrice);
            const totalProductCost = baseCost + platformFees.total;
            const profitPerUnit = recommendedPrice - totalProductCost;
            const profitMargin = recommendedPrice > 0 ? (profitPerUnit / recommendedPrice) * 100 : 0;
            const productRevenue = recommendedPrice * product.quantity;

            totalRevenue += productRevenue;
            totalCost += totalProductCost * product.quantity;
            totalProfit += profitPerUnit * product.quantity;

            exportData.push([
                product.name,
                product.costPrice,
                product.quantity,
                product.shippingCost,
                product.packagingFee,
                Math.round(recommendedPrice),
                Math.round(profitPerUnit),
                Math.round(profitMargin * 100) / 100,
                Math.round(productRevenue),
                product.notes || ''
            ]);
        });

        // Create products sheet
        const ws = XLSX.utils.aoa_to_sheet(exportData);

        // Set column widths
        ws['!cols'] = [
            { width: 25 }, // Tên sản phẩm
            { width: 15 }, // Giá nhập
            { width: 12 }, // Số lượng
            { width: 15 }, // Phí ship
            { width: 15 }, // Phí đóng gói
            { width: 18 }, // Giá bán đề xuất
            { width: 18 }, // Lợi nhuận/đơn vị
            { width: 15 }, // Tỷ suất LN
            { width: 18 }, // Tổng doanh thu
            { width: 30 }  // Ghi chú
        ];

        // Style header row
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4FACFE" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        for (let col = 0; col < 10; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!ws[cellRef]) ws[cellRef] = {};
            ws[cellRef].s = headerStyle;
        }

        XLSX.utils.book_append_sheet(wb, ws, 'Chi tiết sản phẩm');

        // Create summary sheet
        const feeSummaryRows = Object.values(CONFIG.fees).map(fee => [
            `${fee.label}:`,
            fee.type === 'percentage'
                ? `${fee.value}% doanh thu`
                : `${Math.round(fee.value).toLocaleString('vi-VN')} VND/đơn`
        ]);

        const summaryData = [
            ['BÁO CÁO TỔNG KẾT PHÂN TÍCH GIÁ'],
            [''],
            ['THÔNG TIN CHUNG:'],
            ['Ngày xuất báo cáo:', new Date().toLocaleDateString('vi-VN')],
            ['Tổng số sản phẩm:', products.length],
            [''],
            ['TỔNG KẾT TÀI CHÍNH:'],
            ['Tổng doanh thu dự kiến:', Math.round(totalRevenue).toLocaleString('vi-VN') + ' VND'],
            ['Tổng chi phí:', Math.round(totalCost).toLocaleString('vi-VN') + ' VND'],
            ['Tổng lợi nhuận dự kiến:', Math.round(totalProfit).toLocaleString('vi-VN') + ' VND'],
            ['Tỷ suất lợi nhuận trung bình:', totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 + '%' : '0%'],
            [''],
            ['CHI TIẾT PHÍ NỀN TẢNG:'],
            ...feeSummaryRows,
            ['Dự phòng hoàn hàng:', `${CONFIG.risk.returnRate}% doanh thu + ${Math.round(CONFIG.risk.returnHandlingCost).toLocaleString('vi-VN')} VND/đơn × tỉ lệ hoàn`],
            [''],
            ['GHI CHÚ:'],
            ['- Giá bán đề xuất đã bao gồm phí nền tảng và dự phòng rủi ro'],
            ['- Tỷ suất lợi nhuận được tính sau khi trừ phí và rủi ro'],
            ['- Các số liệu là ước tính dựa trên dữ liệu nhập vào'],
            ['- Cần xem xét thêm các yếu tố thị trường khi định giá']
        ];

        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        summaryWs['!cols'] = [{ width: 30 }, { width: 40 }];

        // Style summary header
        if (summaryWs['A1']) {
            summaryWs['A1'].s = {
                font: { bold: true, size: 16, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "28A745" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }

        XLSX.utils.book_append_sheet(wb, summaryWs, 'Tổng kết');

        // Generate and download file
        const fileName = `Phan_Tich_Gia_San_Pham_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        hideLoading();
        showMessage('✅ Đã xuất file Excel thành công!', 'success');

    } catch (error) {
        hideLoading();
        showMessage('❌ Lỗi khi xuất Excel: ' + error.message, 'error');
        console.error('Excel export error:', error);
    }
}

// Mode toggle functions
function toggleCurrencyMode() {
    currencyMode = document.getElementById('currencyMode').checked;
    document.getElementById('currencyLabel').textContent = currencyMode ? 'CNY' : 'VND';
    document.getElementById('currencySettings').style.display = currencyMode ? 'block' : 'none';

    // Convert existing product prices
    products.forEach(product => {
        if (currencyMode && !product.costPriceCNY) {
            product.costPriceCNY = product.costPrice / exchangeRate;
        } else if (!currencyMode && product.costPriceCNY) {
            product.costPrice = product.costPriceCNY * exchangeRate;
        }
    });

    renderProductList();
    calculateMultiProduct();
    saveToStorage();
}

function toggleBatchShipping() {
    batchShippingMode = document.getElementById('batchShippingMode').checked;
    document.getElementById('batchShippingSettings').style.display = batchShippingMode ? 'block' : 'none';

    if (batchShippingMode) {
        calculateBatchShipping();
    } else {
        // Reset individual shipping costs
        products.forEach(product => {
            product.shippingCost = 0;
        });
    }

    renderProductList();
    calculateMultiProduct();
    saveToStorage();
}

function updateExchangeRate() {
    exchangeRate = parseFloat(document.getElementById('exchangeRate').value) || 4000;
    document.getElementById('exchangeDisplay').textContent = exchangeRate.toLocaleString('vi-VN');

    // Update all product prices
    products.forEach(product => {
        if (currencyMode && product.costPriceCNY) {
            product.costPrice = product.costPriceCNY * exchangeRate;
        }
    });

    renderProductList();
    calculateMultiProduct();
    saveToStorage();
}

function calculateBatchShipping() {
    if (!batchShippingMode) return;

    const totalShipping = parseFloat(document.getElementById('totalBatchShipping').value) || 0;
    const distributionMethod = document.querySelector('input[name="distributionMethod"]:checked').value;

    if (products.length === 0 || totalShipping === 0) return;

    let totalWeight = 0;
    let totalValue = 0;
    let totalQuantity = 0;

    // Calculate totals for distribution
    products.forEach(product => {
        totalWeight += (product.weight || 1) * product.quantity;
        totalValue += product.costPrice * product.quantity;
        totalQuantity += product.quantity;
    });

    // Distribute shipping cost
    products.forEach(product => {
        switch (distributionMethod) {
            case 'equal':
                product.shippingCost = totalShipping / products.length;
                break;
            case 'value':
                if (totalValue > 0) {
                    product.shippingCost = (product.costPrice * product.quantity / totalValue) * totalShipping;
                }
                break;
            case 'quantity':
                if (totalQuantity > 0) {
                    product.shippingCost = (product.quantity / totalQuantity) * totalShipping;
                }
                break;
        }
    });

    renderProductList();
    calculateMultiProduct();
}

// Voucher management functions
function addVoucher() {
    const type = document.getElementById('voucherType').value;
    const value = parseFloat(document.getElementById('voucherValue').value);
    const minOrder = parseFloat(document.getElementById('voucherMinOrder').value);
    const description = document.getElementById('voucherDescription').value;

    if (!value || !minOrder || !description) {
        showMessage('❌ Vui lòng điền đầy đủ thông tin voucher', 'error');
        return;
    }

    const voucher = {
        id: Date.now().toString(),
        type: type,
        value: value,
        minOrder: minOrder,
        description: description
    };

    vouchers.push(voucher);
    renderVoucherList();
    calculateMultiProduct();

    // Clear form
    document.getElementById('voucherValue').value = '';
    document.getElementById('voucherMinOrder').value = '';
    document.getElementById('voucherDescription').value = '';

    saveToStorage();
}

function removeVoucher(voucherId) {
    vouchers = vouchers.filter(v => v.id !== voucherId);
    renderVoucherList();
    calculateMultiProduct();
    saveToStorage();
}

function renderVoucherList() {
    const container = document.getElementById('voucherList');
    container.innerHTML = vouchers.map(voucher => `
        <div class="voucher-item">
            <div>
                <strong>${voucher.description}</strong><br>
                <small>Giảm ${voucher.type === 'percentage' ? voucher.value + '%' : formatCurrency(voucher.value)}
                cho đơn từ ${formatCurrency(voucher.minOrder)}</small>
            </div>
            <button class="remove-product" onclick="removeVoucher('${voucher.id}')">🗑️</button>
        </div>
    `).join('');
}

function findBestVoucher(orderTotal) {
    let bestVoucher = null;
    let maxDiscount = 0;

    vouchers.forEach(voucher => {
        if (orderTotal >= voucher.minOrder) {
            let discount = 0;
            if (voucher.type === 'fixed') {
                discount = voucher.value;
            } else if (voucher.type === 'percentage') {
                discount = orderTotal * (voucher.value / 100);
            }

            if (discount > maxDiscount) {
                maxDiscount = discount;
                bestVoucher = voucher;
            }
        }
    });

    return { voucher: bestVoucher, discount: maxDiscount };
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
