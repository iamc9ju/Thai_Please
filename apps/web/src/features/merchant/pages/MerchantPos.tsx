import { LoadingState } from '../../../components/LoadingState';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  FileText,
  LogOut,
  ShoppingCart,
  Store,
  Wallet,
} from 'lucide-react';
import QRCode from 'qrcode';
import { th } from '../../../i18n/th';
import { useLatestRequest } from '../../../lib/use-latest-request';
import { DigitalReceiptModal } from '../../consumer/components/DigitalReceiptModal';
import type { ReceiptDetail } from '../../consumer/consumer.types';
import {
  createOrder,
  createProduct,
  getCategories,
  getMerchantOrderReceipt,
  getMerchantOrders,
  getMyProducts,
  updateProduct,
  updateProductStatus,
} from '../api/merchant.api';
import type {
  CartItem,
  Category,
  CreateOrderResponse,
  MerchantOrder,
  Product,
} from '../merchant.types';
import {
  openMerchantQrDisplayTab,
  renderMerchantQrDisplayError,
  renderMerchantQrDisplayTab,
} from '../utils/merchant-qr-display';
import { MerchantDashboardView } from '../views/MerchantDashboardView';
import { MerchantOrdersView } from '../views/MerchantOrdersView';
import { MerchantQrView } from '../views/MerchantQrView';
import { MerchantSalesView } from '../views/MerchantSalesView';
import { MerchantWalletView } from '../views/MerchantWalletView';

type PosView = 'pos' | 'qr' | 'orders' | 'wallet' | 'dashboard';
type ProductStatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

interface MerchantPosProps {
  merchantName?: string;
  onLogout: () => void;
}

export function MerchantPos({
  merchantName = 'ร้านค้าชุมชน',
  onLogout,
}: MerchantPosProps) {
  const navCopy = th.merchantPortal.nav;
  const posCopy = th.merchantPortal.pos;
  const [view, setView] = useState<PosView>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreateOrderResponse | null>(
    null,
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [productStatusFilter, setProductStatusFilter] =
    useState<ProductStatusFilter>('ACTIVE');
  const [isManageMode, setIsManageMode] = useState(false);

  // Add Product Modal state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    productName: '',
    price: '',
    categoryId: '',
    description: '',
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Edit Product Modal state (FR-M02)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<{
    productName: string;
    price: string;
    categoryId: string;
    description: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    productName: '',
    price: '',
    categoryId: '',
    description: '',
    status: 'ACTIVE',
  });
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
  const [togglingProductId, setTogglingProductId] = useState<string | null>(
    null,
  );

  const [qrCountdown, setQrCountdown] = useState<number>(0);
  const [copiedToken, setCopiedToken] = useState(false);
  const [paidOrderNotification, setPaidOrderNotification] =
    useState<MerchantOrder | null>(null);
  const [qrReceiptDetail, setQrReceiptDetail] = useState<ReceiptDetail | null>(
    null,
  );
  const [isLoadingQrReceipt, setIsLoadingQrReceipt] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getMyProducts(true), getCategories()])
      .then(([loadedProducts, loadedCategories]) => {
        if (!isMounted) return;
        setProducts(loadedProducts);
        setCategories(loadedCategories);
      })
      .catch((caughtError: unknown) => {
        if (!isMounted) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'ไม่สามารถโหลดข้อมูลได้',
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // QR countdown timer
  useEffect(() => {
    if (!createdOrder?.qrExpiresAt || paidOrderNotification) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor(
          (new Date(createdOrder.qrExpiresAt).getTime() - Date.now()) / 1000,
        ),
      );
      setQrCountdown(remaining);
      if (remaining === 0) setCreatedOrder(null);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdOrder, paidOrderNotification]);

  // FR-M05: Auto-poll payment status while viewing active QR
  useEffect(() => {
    if (view !== 'qr' || !createdOrder || paidOrderNotification) return;
    let active = true;

    const checkStatus = async () => {
      try {
        const orders = await getMerchantOrders();
        if (!active) return;
        const matched = orders.find(
          (o) => o.orderId === createdOrder.orderId && o.status === 'PAID',
        );
        if (matched) {
          setPaidOrderNotification(matched);
        }
      } catch {
        // Ignore transient polling errors
      }
    };

    const intervalId = setInterval(() => {
      void checkStatus();
    }, 3000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [view, createdOrder, paidOrderNotification]);

  const productCounts = useMemo(() => {
    const activeCount = products.filter((p) => p.status === 'ACTIVE').length;
    const inactiveCount = products.filter(
      (p) => p.status === 'INACTIVE',
    ).length;
    return {
      active: activeCount,
      inactive: inactiveCount,
      all: products.length,
    };
  }, [products]);

  const filterCategories = useMemo(() => {
    const categoryIdsWithVisibleProducts = new Set(
      products
        .filter((product) => {
          if (productStatusFilter === 'ALL') return true;
          return product.status === productStatusFilter;
        })
        .map((product) => String(product.categoryId)),
    );

    return categories.filter((category) =>
      categoryIdsWithVisibleProducts.has(String(category.categoryId)),
    );
  }, [categories, products, productStatusFilter]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (
        selectedCategory &&
        String(p.categoryId) !== String(selectedCategory)
      ) {
        return false;
      }
      if (productStatusFilter === 'ACTIVE' && p.status !== 'ACTIVE') {
        return false;
      }
      if (productStatusFilter === 'INACTIVE' && p.status !== 'INACTIVE') {
        return false;
      }
      return true;
    });
  }, [products, selectedCategory, productStatusFilter]);

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const addToCart = (product: Product) => {
    if (product.status !== 'ACTIVE') return;
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.product.productId === product.productId,
      );
      if (existing) {
        return prev.map((i) =>
          i.product.productId === product.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.productId === productId
            ? { ...i, quantity: i.quantity + delta }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) return;
    const qrDisplayTab = openMerchantQrDisplayTab();
    setIsCreatingOrder(true);
    setError(null);
    setPaidOrderNotification(null);
    try {
      const order = await createOrder({
        items: cart.map((i) => ({
          productId: Number(i.product.productId),
          quantity: i.quantity,
        })),
      });
      setCreatedOrder(order);
      setQrCountdown(
        Math.max(
          0,
          Math.floor(
            (new Date(order.qrExpiresAt).getTime() - Date.now()) / 1000,
          ),
        ),
      );
      const qrUrl = await QRCode.toDataURL(order.qrToken, {
        width: 300,
        margin: 2,
        color: { dark: '#003d82', light: '#ffffff' },
      });
      if (qrDisplayTab) {
        renderMerchantQrDisplayTab(qrDisplayTab, order, qrUrl);
      }
      setQrDataUrl(qrUrl);
      setCart([]);
      setView('qr');
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'ไม่สามารถสร้าง Order ได้';
      if (qrDisplayTab) {
        renderMerchantQrDisplayError(qrDisplayTab, message);
      }
      setError(message);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleOpenPaidQrReceipt = async (orderId: string) => {
    setIsLoadingQrReceipt(true);
    try {
      const receipt = await getMerchantOrderReceipt(orderId);
      setQrReceiptDetail(receipt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถเปิดใบเสร็จได้');
    } finally {
      setIsLoadingQrReceipt(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!newProduct.productName || !newProduct.price || !newProduct.categoryId)
      return;
    setIsSavingProduct(true);
    setError(null);
    try {
      const productInput = {
        productName: newProduct.productName,
        price: parseFloat(newProduct.price),
        categoryId: parseInt(newProduct.categoryId),
        ...(newProduct.description
          ? { description: newProduct.description }
          : {}),
      };
      const saved = await createProduct(productInput);
      setProducts((prev) => [saved, ...prev]);
      setNewProduct({
        productName: '',
        price: '',
        categoryId: '',
        description: '',
      });
      setShowAddProduct(false);
      setSuccessMessage(posCopy.productSavedMessage(saved.productName));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถบันทึกสินค้าได้');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      productName: product.productName,
      price: String(product.price),
      categoryId: String(product.categoryId),
      description: product.description ?? '',
      status: product.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
  };

  const syncProductInStateAndCart = (updated: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.productId === updated.productId ? updated : p)),
    );
    setCart((prev) =>
      updated.status === 'ACTIVE'
        ? prev.map((item) =>
            item.product.productId === updated.productId
              ? { ...item, product: updated }
              : item,
          )
        : prev.filter((item) => item.product.productId !== updated.productId),
    );
  };

  const handleUpdateProduct = async () => {
    if (
      !editingProduct ||
      !editForm.productName.trim() ||
      !editForm.price ||
      !editForm.categoryId
    ) {
      return;
    }
    setIsUpdatingProduct(true);
    setError(null);
    try {
      const updated = await updateProduct(editingProduct.productId, {
        productName: editForm.productName.trim(),
        price: parseFloat(editForm.price),
        categoryId: parseInt(editForm.categoryId, 10),
        description: editForm.description.trim(),
        status: editForm.status,
      });
      syncProductInStateAndCart(updated);
      setEditingProduct(null);
      setSuccessMessage(posCopy.productSavedMessage(updated.productName));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'ไม่สามารถอัปเดตข้อมูลสินค้าได้',
      );
    } finally {
      setIsUpdatingProduct(false);
    }
  };

  const handleToggleProductStatus = async (product: Product) => {
    const nextStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setTogglingProductId(product.productId);
    setError(null);
    try {
      const updated = await updateProductStatus(product.productId, nextStatus);
      syncProductInStateAndCart(updated);
      setSuccessMessage(
        posCopy.productStatusChangedMessage(
          updated.productName,
          updated.status === 'ACTIVE',
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'ไม่สามารถเปลี่ยนสถานะสินค้าได้',
      );
    } finally {
      setTogglingProductId(null);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(n);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const navItems: Array<{
    id: PosView;
    label: string;
    icon: typeof ShoppingCart;
  }> = [
    { id: 'pos', label: navCopy.pos, icon: ShoppingCart },
    { id: 'orders', label: navCopy.orders, icon: FileText },
    { id: 'wallet', label: navCopy.wallet, icon: Wallet },
    { id: 'dashboard', label: navCopy.dashboard, icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Blue Theme Top Header */}
      <header className="sticky top-0 z-20 border-b border-blue-900/15 bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-white/15 text-white shadow-inner backdrop-blur-sm border border-white/20">
              <Store className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-blue-100">
                {th.merchantPortal.brandSubtitle}
              </p>
              <h1 className="text-base font-extrabold tracking-tight text-white">
                {merchantName}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav
              aria-label="เมนูหลักร้านค้า"
              className="flex flex-wrap gap-1 rounded-2xl bg-white/10 p-1 backdrop-blur-sm border border-white/15"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = view === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#003d82] shadow-sm'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-100 hover:bg-white/20 hover:text-white transition-colors border border-white/15 cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>{th.merchantPortal.logout}</span>
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <div
            role="alert"
            className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm"
          >
            <span>⚠️</span> {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-rose-400 hover:text-rose-700 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <div
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm"
          >
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="ml-auto text-emerald-500 hover:text-emerald-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* ── POS VIEW (FR-M02, FR-M03) ── */}
        {view === 'pos' && (
          <MerchantSalesView
            categories={categories}
            filterCategories={filterCategories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            isManageMode={isManageMode}
            setIsManageMode={setIsManageMode}
            productStatusFilter={productStatusFilter}
            setProductStatusFilter={setProductStatusFilter}
            productCounts={productCounts}
            showAddProduct={showAddProduct}
            setShowAddProduct={setShowAddProduct}
            newProduct={newProduct}
            setNewProduct={setNewProduct}
            isSavingProduct={isSavingProduct}
            handleSaveProduct={handleSaveProduct}
            editingProduct={editingProduct}
            setEditingProduct={setEditingProduct}
            editForm={editForm}
            setEditForm={setEditForm}
            isUpdatingProduct={isUpdatingProduct}
            handleUpdateProduct={handleUpdateProduct}
            isLoading={isLoading}
            filteredProducts={filteredProducts}
            togglingProductId={togglingProductId}
            addToCart={addToCart}
            handleOpenEditProduct={handleOpenEditProduct}
            handleToggleProductStatus={handleToggleProductStatus}
            formatCurrency={formatCurrency}
            cart={cart}
            setCart={setCart}
            updateQty={updateQty}
            cartTotal={cartTotal}
            handleCreateOrder={handleCreateOrder}
            isCreatingOrder={isCreatingOrder}
          />
        )}

        {/* ── QR VIEW (FR-M04, FR-M05) ── */}
        {view === 'qr' && (
          <MerchantQrView
            createdOrder={createdOrder}
            qrDataUrl={qrDataUrl}
            paidOrderNotification={paidOrderNotification}
            formatCurrency={formatCurrency}
            handleOpenPaidQrReceipt={handleOpenPaidQrReceipt}
            isLoadingQrReceipt={isLoadingQrReceipt}
            setCreatedOrder={setCreatedOrder}
            setQrDataUrl={setQrDataUrl}
            setPaidOrderNotification={setPaidOrderNotification}
            setView={setView}
            qrCountdown={qrCountdown}
            formatTime={formatTime}
            copiedToken={copiedToken}
            setCopiedToken={setCopiedToken}
          />
        )}

        {/* ── ORDERS VIEW (FR-M08) ── */}
        {view === 'orders' && <MerchantOrdersView />}

        {/* ── WALLET VIEW (FR-M06) ── */}
        {view === 'wallet' && <MerchantWalletView />}

        {/* ── DASHBOARD VIEW (FR-M07) ── */}
        {view === 'dashboard' && <MerchantDashboardView />}
      </main>

      {qrReceiptDetail && (
        <DigitalReceiptModal
          receipt={qrReceiptDetail}
          onClose={() => setQrReceiptDetail(null)}
        />
      )}
    </div>
  );
}
