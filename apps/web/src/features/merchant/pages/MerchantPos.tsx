import { LoadingState } from '../../../components/LoadingState';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  LogOut,
  Power,
  Plus,
  QrCode,
  Search,
  Settings2,
  ShoppingCart,
  Store,
  TrendingUp,
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
import { MerchantDashboardView } from '../views/MerchantDashboardView';
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
      setQrDataUrl(qrUrl);
      setCart([]);
      setView('qr');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถสร้าง Order ได้');
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
    { id: 'qr', label: navCopy.qr, icon: QrCode },
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
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Product Panel */}
            <div className="flex-1">
              {/* Top Toolbar: Category filter + Manage Mode & Add Product */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    !selectedCategory
                      ? 'bg-[#0056b3] text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-[#0056b3] hover:text-[#0056b3]'
                  }`}
                >
                  ทั้งหมด
                </button>
                {categories.map((c) => (
                  <button
                    key={String(c.categoryId)}
                    type="button"
                    onClick={() => setSelectedCategory(String(c.categoryId))}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      selectedCategory === String(c.categoryId)
                        ? 'bg-[#0056b3] text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-[#0056b3] hover:text-[#0056b3]'
                    }`}
                  >
                    {c.categoryName}
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = !isManageMode;
                      setIsManageMode(nextMode);
                      if (nextMode) {
                        setProductStatusFilter('ALL');
                      } else {
                        setProductStatusFilter('ACTIVE');
                      }
                    }}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isManageMode
                        ? 'bg-[#003d82] text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-[#0056b3] hover:text-[#0056b3]'
                    }`}
                  >
                    <Settings2 className="size-3.5" />
                    <span>
                      {isManageMode
                        ? posCopy.exitManageProducts
                        : posCopy.manageProductsToggle}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddProduct(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1.5 text-xs font-bold text-[#0056b3] hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>{posCopy.addProductButton}</span>
                  </button>
                </div>
              </div>

              {/* Status Filter Bar (FR-M02) */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-bold text-slate-500">
                    สถานะสินค้า:
                  </span>
                  {(
                    [
                      {
                        id: 'ACTIVE',
                        label: `${posCopy.filterActive} (${productCounts.active})`,
                      },
                      {
                        id: 'INACTIVE',
                        label: `${posCopy.filterInactive} (${productCounts.inactive})`,
                      },
                      {
                        id: 'ALL',
                        label: `${posCopy.filterAll} (${productCounts.all})`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setProductStatusFilter(tab.id)}
                      className={`rounded-xl px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                        productStatusFilter === tab.id
                          ? 'bg-[#0056b3] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500">
                  💡 กดปุ่ม <strong>แก้ไข</strong> หรือ{' '}
                  <strong>ปิดการขาย</strong>{' '}
                  บนการ์ดสินค้าได้ทันทีโดยไม่กระทบใบเสร็จย้อนหลัง
                </span>
              </div>

              {/* Add Product Modal */}
              {showAddProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                  <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                    <h3 className="mb-4 text-base font-extrabold text-slate-900">
                      {posCopy.addModalTitle}
                    </h3>
                    <div className="space-y-3">
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                        placeholder="ชื่อสินค้า *"
                        value={newProduct.productName}
                        onChange={(e) =>
                          setNewProduct((p) => ({
                            ...p,
                            productName: e.target.value,
                          }))
                        }
                      />
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                        placeholder="ราคา (บาท) *"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={newProduct.price}
                        onChange={(e) =>
                          setNewProduct((p) => ({
                            ...p,
                            price: e.target.value,
                          }))
                        }
                      />
                      <select
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                        value={newProduct.categoryId}
                        onChange={(e) =>
                          setNewProduct((p) => ({
                            ...p,
                            categoryId: e.target.value,
                          }))
                        }
                      >
                        <option value="">เลือกหมวดหมู่ *</option>
                        {categories.map((c) => (
                          <option
                            key={String(c.categoryId)}
                            value={String(c.categoryId)}
                          >
                            {c.categoryName}
                          </option>
                        ))}
                      </select>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                        placeholder="รายละเอียด (ไม่บังคับ)"
                        value={newProduct.description}
                        onChange={(e) =>
                          setNewProduct((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="mt-5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddProduct(false)}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveProduct()}
                        disabled={
                          isSavingProduct ||
                          !newProduct.productName ||
                          !newProduct.price ||
                          !newProduct.categoryId
                        }
                        className="flex-1 rounded-xl bg-[#0056b3] py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#004494] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isSavingProduct ? 'กำลังบันทึก...' : 'บันทึก'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Product Modal (FR-M02) */}
              {editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                    <h3 className="mb-1 text-base font-extrabold text-slate-900">
                      {posCopy.editModalTitle}
                    </h3>
                    <p className="mb-4 text-xs text-slate-500">
                      {posCopy.immutableSnapshotNote}
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="edit-product-name"
                          className="mb-1 block text-xs font-bold text-slate-700"
                        >
                          ชื่อสินค้า *
                        </label>
                        <input
                          id="edit-product-name"
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                          value={editForm.productName}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              productName: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="edit-product-price"
                          className="mb-1 block text-xs font-bold text-slate-700"
                        >
                          ราคา (บาท) *
                        </label>
                        <input
                          id="edit-product-price"
                          type="number"
                          min="0.01"
                          step="0.01"
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                          value={editForm.price}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              price: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="edit-product-category"
                          className="mb-1 block text-xs font-bold text-slate-700"
                        >
                          หมวดหมู่สินค้า *
                        </label>
                        <select
                          id="edit-product-category"
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                          value={editForm.categoryId}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              categoryId: e.target.value,
                            }))
                          }
                        >
                          {categories.map((c) => (
                            <option
                              key={String(c.categoryId)}
                              value={String(c.categoryId)}
                            >
                              {c.categoryName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="edit-product-description"
                          className="mb-1 block text-xs font-bold text-slate-700"
                        >
                          รายละเอียดสินค้า
                        </label>
                        <input
                          id="edit-product-description"
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                          placeholder="รายละเอียด (ไม่บังคับ)"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="edit-product-status"
                          className="mb-1 block text-xs font-bold text-slate-700"
                        >
                          สถานะการจำหน่าย
                        </label>
                        <select
                          id="edit-product-status"
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                          value={editForm.status}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              status:
                                e.target.value === 'INACTIVE'
                                  ? 'INACTIVE'
                                  : 'ACTIVE',
                            }))
                          }
                        >
                          <option value="ACTIVE">
                            พร้อมขายหน้าร้าน (ACTIVE)
                          </option>
                          <option value="INACTIVE">
                            ปิดการขายชั่วคราว (INACTIVE)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpdateProduct()}
                        disabled={
                          isUpdatingProduct ||
                          !editForm.productName.trim() ||
                          !editForm.price ||
                          !editForm.categoryId
                        }
                        className="flex-1 rounded-xl bg-[#0056b3] py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#004494] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isUpdatingProduct
                          ? 'กำลังบันทึก...'
                          : 'บันทึกการแก้ไข'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isLoading ? (
                <LoadingState label={posCopy.loading} />
              ) : filteredProducts.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white text-slate-500">
                  <span className="text-3xl">📦</span>
                  <p className="text-sm font-medium">
                    ไม่พบสินค้าในตัวกรองนี้ หรือกดปุ่ม &quot;+ เพิ่มสินค้า&quot;
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map((product) => {
                    const inCart = cart.find(
                      (i) => i.product.productId === product.productId,
                    );
                    const isInactive = product.status === 'INACTIVE';
                    const isToggling = togglingProductId === product.productId;

                    return (
                      <div
                        key={product.productId}
                        className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition-all ${
                          isInactive
                            ? 'border-slate-200 bg-slate-100/80 opacity-85'
                            : 'border-slate-200/80 bg-white hover:border-[#0056b3] hover:shadow-md'
                        }`}
                      >
                        {/* Clickable area to add to POS cart */}
                        <button
                          type="button"
                          disabled={isInactive}
                          onClick={() => addToCart(product)}
                          className={`flex flex-1 flex-col text-left ${
                            isInactive
                              ? 'cursor-not-allowed'
                              : 'cursor-pointer active:scale-98'
                          }`}
                        >
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                              🍽️
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  isInactive
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {isInactive
                                  ? posCopy.statusInactiveBadge
                                  : posCopy.statusActiveBadge}
                              </span>
                              {inCart && (
                                <span className="flex size-6 items-center justify-center rounded-full bg-[#0056b3] text-xs font-extrabold text-white shadow-sm">
                                  {inCart.quantity}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-sm font-bold text-slate-900 line-clamp-2">
                            {product.productName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {product.categoryName}
                          </p>
                          {product.description && (
                            <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">
                              {product.description}
                            </p>
                          )}
                          <p className="mt-auto pt-3 font-mono text-base font-extrabold text-[#0056b3]">
                            {formatCurrency(product.price)}
                          </p>
                        </button>

                        {/* Product Management Actions (FR-M02: Edit & Activate/Deactivate) */}
                        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(product)}
                            aria-label={`แก้ไข ${product.productName}`}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-[#0056b3] hover:bg-blue-50 hover:text-[#0056b3] transition-colors cursor-pointer"
                          >
                            <Edit3 className="size-3" />
                            <span>{posCopy.editProductButton}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() =>
                              void handleToggleProductStatus(product)
                            }
                            aria-label={
                              isInactive
                                ? `เปิดขาย ${product.productName}`
                                : `ปิดการขาย ${product.productName}`
                            }
                            className={`inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                              isInactive
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            }`}
                          >
                            <Power className="size-3" />
                            <span>
                              {isToggling
                                ? '...'
                                : isInactive
                                  ? posCopy.activateButton
                                  : posCopy.deactivateButton}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Panel */}
            <div className="w-full lg:w-80 shrink-0">
              <div className="sticky top-20 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <ShoppingCart className="size-4 text-[#0056b3]" />
                    <span>ตะกร้าสร้างรายการขาย</span>
                  </h2>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-400">
                    <ShoppingCart className="size-6" />
                    <p className="text-xs font-medium">
                      เลือกสินค้าจากด้านซ้าย
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.productId}
                        className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900">
                            {item.product.productName}
                          </p>
                          <p className="font-mono text-xs font-semibold text-[#0056b3]">
                            {formatCurrency(item.product.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateQty(item.product.productId, -1)
                            }
                            className="flex size-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-extrabold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.product.productId, 1)}
                            className="flex size-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600">
                      รวมทั้งสิ้น
                    </span>
                    <span className="font-mono text-xl font-black text-[#0056b3]">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>
                  <button
                    id="create-order-btn"
                    type="button"
                    onClick={() => void handleCreateOrder()}
                    disabled={cart.length === 0 || isCreatingOrder}
                    className="w-full rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] py-3.5 text-sm font-bold text-white shadow-md shadow-blue-900/15 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                  >
                    {isCreatingOrder ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                        กำลังสร้าง QR...
                      </span>
                    ) : (
                      '📱 สร้าง QR ชำระเงิน'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── QR VIEW (FR-M04, FR-M05) ── */}
        {view === 'qr' && (
          <div className="flex flex-col items-center py-4">
            {createdOrder && qrDataUrl ? (
              <div className="w-full max-w-md">
                {paidOrderNotification ? (
                  <div className="rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-lg">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="size-9" />
                    </div>
                    <h3 className="mt-4 text-xl font-extrabold text-emerald-800">
                      ลูกค้าชำระเงินสำเร็จแล้ว!
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Order #{paidOrderNotification.orderId} · ลูกค้า:{' '}
                      {paidOrderNotification.consumerName ?? 'ประชาชน'}
                    </p>
                    <p className="mt-3 font-mono text-3xl font-black text-[#0056b3]">
                      {formatCurrency(paidOrderNotification.finalAmount)}
                    </p>
                    <div className="mt-3 flex justify-center gap-2 text-xs">
                      <span className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-1 font-semibold text-sky-800">
                        เงินสนับสนุนรัฐ:{' '}
                        {formatCurrency(paidOrderNotification.subsidyAmount)}
                      </span>
                      <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 font-semibold text-emerald-800">
                        เงินลูกค้า:{' '}
                        {formatCurrency(paidOrderNotification.userPaidAmount)}
                      </span>
                    </div>
                    <div className="mt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleOpenPaidQrReceipt(
                            paidOrderNotification.orderId,
                          )
                        }
                        disabled={isLoadingQrReceipt}
                        className="w-full rounded-2xl bg-[#0056b3] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
                      >
                        {isLoadingQrReceipt
                          ? 'กำลังเปิดใบเสร็จ...'
                          : '📄 เปิดดูใบเสร็จรับเงินดิจิทัล'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatedOrder(null);
                          setQrDataUrl(null);
                          setPaidOrderNotification(null);
                          setView('pos');
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        ← สร้างรายการขายใหม่
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg">
                    <div className="mb-4 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#0056b3]">
                        Order #{createdOrder.orderId} · รอลูกค้าสแกนชำระ
                      </span>
                      <p className="mt-2 font-mono text-3xl font-black text-[#003d82]">
                        {formatCurrency(createdOrder.finalAmount)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        หมดอายุใน{' '}
                        <span
                          className={`font-mono font-bold ${
                            qrCountdown < 60
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {formatTime(qrCountdown)}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl border-2 border-blue-100 bg-white p-4 shadow-md">
                        <img
                          src={qrDataUrl}
                          alt="QR Code"
                          className="size-56"
                        />
                      </div>

                      <a
                        href={qrDataUrl}
                        download={`thai-please-order-${createdOrder.orderId}.png`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-[#0056b3] hover:bg-blue-100 transition-colors"
                      >
                        <Download className="size-3.5" />
                        <span>{posCopy.downloadQrImage}</span>
                      </a>
                    </div>

                    {/* QR Token copy box for desktop testing & manual input */}
                    {createdOrder.qrToken && (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-[#003d82]">
                            <span>🔑</span> รหัส QR Token
                          </span>
                          <button
                            type="button"
                            id="copy-token-btn"
                            onClick={() => {
                              void navigator.clipboard.writeText(
                                createdOrder.qrToken,
                              );
                              setCopiedToken(true);
                              setTimeout(() => setCopiedToken(false), 2000);
                            }}
                            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                              copiedToken
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-[#0056b3] text-white hover:bg-[#004494]'
                            }`}
                          >
                            <Copy className="size-3" />
                            <span>
                              {copiedToken ? 'คัดลอกแล้ว!' : 'คัดลอก Token'}
                            </span>
                          </button>
                        </div>
                        <p className="select-all break-all rounded-xl border border-blue-200/70 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-slate-700">
                          {createdOrder.qrToken}
                        </p>
                        <p className="mt-2 text-[11px] text-slate-600">
                          💡 สแกนด้วยกล้อง อัปโหลดไฟล์รูป QR
                          หรือคัดลอกรหัสนี้ไปวางในเมนู{' '}
                          <strong>&quot;สแกนจ่าย&quot;</strong>{' '}
                          ฝั่งประชาชนเพื่อทดสอบชำระเงิน
                        </p>
                      </div>
                    )}

                    <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                      <p className="mb-2 text-xs font-bold text-slate-700">
                        รายการสินค้าในบิลนี้
                      </p>
                      {createdOrder.items.map((item, i) => (
                        <div
                          key={i}
                          className="flex justify-between text-xs text-slate-600"
                        >
                          <span>
                            {item.productName} × {item.quantity}
                          </span>
                          <span className="font-mono font-semibold text-slate-800">
                            {formatCurrency(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCreatedOrder(null);
                    setQrDataUrl(null);
                    setPaidOrderNotification(null);
                    setView('pos');
                  }}
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ← กลับไปหน้าร้าน POS
                </button>
              </div>
            ) : (
              <div className="flex h-64 w-full max-w-md flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-500">
                <QrCode className="size-10 text-[#0056b3]" />
                <p className="text-sm font-semibold">
                  ยังไม่มี QR Code ที่กำลังรอชำระ
                </p>
                <button
                  type="button"
                  onClick={() => setView('pos')}
                  className="rounded-xl bg-[#0056b3] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
                >
                  ไปเลือกสินค้าเพื่อสร้าง QR
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS VIEW (FR-M08) ── */}
        {view === 'orders' && <MerchantOrdersList />}

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

// ─── Order History Component (Blue Theme) ─────────────────────────────────────

function MerchantOrdersList() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>(
    'ALL',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetail | null>(
    null,
  );
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  const beginRequest = useLatestRequest();
  const fetchOrders = useCallback(() => {
    const { isCurrent } = beginRequest();
    setIsLoading(true);
    setError(null);
    getMerchantOrders()
      .then((data) => {
        if (isCurrent()) setOrders(data);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent()) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : th.merchantPortal.orders.loadError,
        );
      })
      .finally(() => {
        if (isCurrent()) setIsLoading(false);
      });
  }, [beginRequest]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(n);

  const handleOpenReceipt = async (orderId: string) => {
    setLoadingReceiptId(orderId);
    try {
      const receipt = await getMerchantOrderReceipt(orderId);
      setSelectedReceipt(receipt);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ไม่สามารถเปิดใบเสร็จได้');
    } finally {
      setLoadingReceiptId(null);
    }
  };

  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === 'PAID');
    const totalSales = paidOrders.reduce((sum, o) => sum + o.finalAmount, 0);
    const paidCount = paidOrders.length;
    const pendingCount = orders.filter((o) => o.status !== 'PAID').length;
    return { totalSales, paidCount, pendingCount };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter === 'PAID' && order.status !== 'PAID') return false;
      if (statusFilter === 'PENDING' && order.status === 'PAID') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesId = order.orderId.toLowerCase().includes(query);
        const matchesName = (order.consumerName ?? '')
          .toLowerCase()
          .includes(query);
        if (!matchesId && !matchesName) return false;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  if (isLoading) {
    return <LoadingState label={th.merchantPortal.orders.loading} />;
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-center">
        <p className="mb-2 text-sm font-bold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={fetchOrders}
          className="rounded-xl bg-[#0056b3] px-4 py-2 text-xs font-bold text-white hover:bg-[#004494] transition-colors cursor-pointer"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <span>📋</span> ประวัติคำสั่งซื้อและใบเสร็จดิจิทัล
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            บันทึกคำสั่งซื้อทั้งหมดของร้านค้า ตรวจสอบยอดเงิน
            และเรียกดูใบเสร็จย้อนหลัง
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[#0056b3] shadow-sm hover:bg-blue-50 transition-colors cursor-pointer"
        >
          ↻ รีเฟรชข้อมูล
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>ยอดขายที่ชำระแล้ว</span>
            <TrendingUp className="size-4 text-[#0056b3]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-[#003d82]">
            {formatCurrency(stats.totalSales)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            รวมเงินสนับสนุนภาครัฐและเงินส่วนตัวลูกค้า
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>ชำระสำเร็จ</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-emerald-700">
            {stats.paidCount}{' '}
            <span className="text-xs font-bold text-slate-500">ออเดอร์</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            ออกใบเสร็จดิจิทัลและบันทึกเข้ากระเป๋าร้านค้าแล้ว
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>รอลูกค้าชำระเงิน</span>
            <Clock className="size-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-amber-600">
            {stats.pendingCount}{' '}
            <span className="text-xs font-bold text-slate-500">ออเดอร์</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            สร้าง QR แล้วแต่ยังไม่ได้ชำระ
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหา Order # หรือชื่อลูกค้า..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0056b3] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex w-full sm:w-auto items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'PAID', label: '✓ ชำระแล้ว' },
              { id: 'PENDING', label: '⏳ รอชำระ' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatusFilter(t.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                statusFilter === t.id
                  ? 'bg-[#0056b3] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-200 bg-white text-slate-500">
          <FileText className="size-8 text-slate-400" />
          <p className="text-sm">ไม่พบรายการคำสั่งซื้อ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.orderId}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-blue-200 transition-all"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                    order.status === 'PAID'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {order.status === 'PAID' ? '✓' : '⏳'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-[#003d82]">
                      Order #{order.orderId}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        order.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {order.status === 'PAID' ? 'ชำระแล้ว' : 'รอชำระ'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-700">
                    {order.consumerName
                      ? `ลูกค้า: ${order.consumerName}`
                      : 'รอลูกค้าสแกน'}{' '}
                    · {order.itemCount} รายการ
                  </p>
                  <p className="text-[11px] text-slate-500">
                    เวลา:{' '}
                    {order.paidAt
                      ? new Date(order.paidAt).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }) + ' น.'
                      : new Date(order.createdAt).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }) + ' น.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 pt-2.5 sm:pt-0">
                <div className="text-left sm:text-right">
                  <p className="font-mono text-base font-black text-[#0056b3]">
                    {formatCurrency(order.finalAmount)}
                  </p>
                  {order.status === 'PAID' && (
                    <p className="text-[11px] font-semibold text-emerald-700">
                      สิทธิ์ร่วมจ่าย {formatCurrency(order.subsidyAmount)}
                    </p>
                  )}
                </div>

                {order.status === 'PAID' && (
                  <button
                    type="button"
                    onClick={() => void handleOpenReceipt(order.orderId)}
                    disabled={loadingReceiptId === order.orderId}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-[#0056b3] hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Eye className="size-3.5" />
                    <span>
                      {loadingReceiptId === order.orderId
                        ? 'กำลังโหลด...'
                        : 'ดูใบเสร็จ'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedReceipt && (
        <DigitalReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
