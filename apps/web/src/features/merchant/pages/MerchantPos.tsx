import { useEffect, useMemo, useState } from 'react';
import {
  createOrder,
  createProduct,
  getCategories,
  getMerchantOrderReceipt,
  getMerchantOrders,
  getMyProducts,
} from '../api/merchant.api';
import type {
  CartItem,
  Category,
  CreateOrderResponse,
  MerchantOrder,
  Product,
} from '../merchant.types';
import type { ReceiptDetail } from '../../consumer/consumer.types';
import { DigitalReceiptModal } from '../../consumer/components/DigitalReceiptModal';
import {
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Search,
  TrendingUp,
} from 'lucide-react';
import QRCode from 'qrcode';

type PosView = 'pos' | 'qr' | 'orders';

interface MerchantPosProps {
  merchantName?: string;
  onLogout: () => void;
}

export function MerchantPos({
  merchantName = 'ร้านค้า',
  onLogout,
}: MerchantPosProps) {
  const [view, setView] = useState<PosView>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreateOrderResponse | null>(
    null,
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    productName: '',
    price: '',
    categoryId: '',
    description: '',
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [qrCountdown, setQrCountdown] = useState<number>(0);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getMyProducts(), getCategories()])
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
    if (!createdOrder?.qrExpiresAt) return;
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
  }, [createdOrder]);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.categoryId === selectedCategory)
    : products;

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const addToCart = (product: Product) => {
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
      // Generate QR code image from the token
      const qrUrl = await QRCode.toDataURL(order.qrToken, {
        width: 300,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
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

  const handleSaveProduct = async () => {
    if (!newProduct.productName || !newProduct.price || !newProduct.categoryId)
      return;
    setIsSavingProduct(true);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถบันทึกสินค้าได้');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(n);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-lg shadow-lg">
              🏪
            </div>
            <div>
              <p className="text-xs text-slate-400">Thai Chuay Thai Please</p>
              <h1 className="text-sm font-semibold text-white">
                {merchantName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1 rounded-xl bg-slate-800 p-1">
              {(['pos', 'qr', 'orders'] as PosView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    view === v
                      ? 'bg-orange-500 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {v === 'pos' ? '🛒 POS' : v === 'qr' ? '📱 QR' : '📋 Orders'}
                </button>
              ))}
            </nav>
            <button
              onClick={onLogout}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-3">
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <span>⚠️</span> {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400/60 hover:text-red-400"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-4">
        {/* ── POS VIEW ── */}
        {view === 'pos' && (
          <div className="flex gap-4">
            {/* Product Panel */}
            <div className="flex-1">
              {/* Category filter */}
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    !selectedCategory
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ทั้งหมด
                </button>
                {categories.map((c) => (
                  <button
                    key={String(c.categoryId)}
                    onClick={() => setSelectedCategory(String(c.categoryId))}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedCategory === String(c.categoryId)
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.categoryName}
                  </button>
                ))}
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="ml-auto shrink-0 rounded-full bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
                >
                  + เพิ่มสินค้า
                </button>
              </div>

              {/* Add Product Modal */}
              {showAddProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
                    <h3 className="mb-4 text-base font-semibold text-white">
                      เพิ่มสินค้าใหม่
                    </h3>
                    <div className="space-y-3">
                      <input
                        className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                        className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                        className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                        className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setShowAddProduct(false)}
                        className="flex-1 rounded-xl bg-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => void handleSaveProduct()}
                        disabled={
                          isSavingProduct ||
                          !newProduct.productName ||
                          !newProduct.price ||
                          !newProduct.categoryId
                        }
                        className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                      >
                        {isSavingProduct ? 'กำลังบันทึก...' : 'บันทึก'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <div className="size-8 animate-spin rounded-full border-4 border-orange-500 border-r-transparent" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700 text-slate-500">
                  <span className="text-3xl">📦</span>
                  <p className="text-sm">
                    ยังไม่มีสินค้า กดปุ่ม &quot;+ เพิ่มสินค้า&quot;
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((product) => {
                    const inCart = cart.find(
                      (i) => i.product.productId === product.productId,
                    );
                    return (
                      <button
                        key={product.productId}
                        onClick={() => addToCart(product)}
                        className="group relative flex flex-col rounded-2xl border border-slate-700/50 bg-slate-800/50 p-3 text-left transition-all hover:border-orange-500/50 hover:bg-slate-800 hover:shadow-lg hover:shadow-orange-500/5 active:scale-95"
                      >
                        {inCart && (
                          <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                            {inCart.quantity}
                          </span>
                        )}
                        <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-xl">
                          🍽️
                        </div>
                        <p className="text-xs font-medium text-white line-clamp-2">
                          {product.productName}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {product.categoryName}
                        </p>
                        <p className="mt-auto pt-2 text-sm font-bold text-orange-400">
                          {formatCurrency(product.price)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Panel */}
            <div className="w-72 shrink-0">
              <div className="sticky top-20 rounded-2xl border border-slate-700/50 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    🛒 ตะกร้า
                  </h2>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 text-slate-600">
                    <span className="text-2xl">🛒</span>
                    <p className="text-xs">เลือกสินค้าจากด้านซ้าย</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.productId}
                        className="flex items-center gap-2 rounded-xl bg-slate-800 p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-white">
                            {item.product.productName}
                          </p>
                          <p className="text-xs text-orange-400">
                            {formatCurrency(item.product.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              updateQty(item.product.productId, -1)
                            }
                            className="flex size-6 items-center justify-center rounded-lg bg-slate-700 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.product.productId, 1)}
                            className="flex size-6 items-center justify-center rounded-lg bg-slate-700 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-slate-400">รวม</span>
                    <span className="text-lg font-bold text-orange-400">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>
                  <button
                    id="create-order-btn"
                    onClick={() => void handleCreateOrder()}
                    disabled={cart.length === 0 || isCreatingOrder}
                    className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {isCreatingOrder ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                        กำลังสร้าง...
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

        {/* ── QR VIEW ── */}
        {view === 'qr' && (
          <div className="flex flex-col items-center py-6">
            {createdOrder && qrDataUrl ? (
              <div className="w-full max-w-sm">
                <div className="rounded-3xl border border-slate-700/50 bg-gradient-to-b from-slate-800 to-slate-900 p-6 shadow-2xl">
                  <div className="mb-4 text-center">
                    <p className="text-xs text-slate-400">
                      Order #{createdOrder.orderId}
                    </p>
                    <p className="text-2xl font-bold text-orange-400 mt-1">
                      {formatCurrency(createdOrder.finalAmount)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      หมดอายุใน{' '}
                      <span
                        className={`font-mono font-bold ${qrCountdown < 60 ? 'text-red-400' : 'text-green-400'}`}
                      >
                        {formatTime(qrCountdown)}
                      </span>
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <div className="rounded-2xl bg-white p-4 shadow-xl">
                      <img src={qrDataUrl} alt="QR Code" className="size-56" />
                    </div>
                  </div>

                  {/* QR Token copy box for desktop testing & manual input */}
                  {createdOrder.qrToken && (
                    <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-3.5 shadow-inner">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
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
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                            copiedToken
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30'
                          }`}
                        >
                          {copiedToken ? '✓ คัดลอกแล้ว!' : '📋 คัดลอก Token'}
                        </button>
                      </div>
                      <p className="font-mono text-[11px] text-slate-200 break-all bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 select-all leading-relaxed">
                        {createdOrder.qrToken}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        💡 คัดลอกรหัสนี้ไปวางในเมนู{' '}
                        <strong>"สแกน / ชำระเงิน"</strong>{' '}
                        ฝั่งประชาชนเพื่อทดสอบชำระเงิน
                      </p>
                    </div>
                  )}

                  <div className="mt-4 space-y-1.5 rounded-xl bg-slate-800/50 p-3">
                    <p className="text-xs font-medium text-slate-300 mb-2">
                      รายการสินค้า
                    </p>
                    {createdOrder.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs text-slate-400"
                      >
                        <span>
                          {item.productName} × {item.quantity}
                        </span>
                        <span>{formatCurrency(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-center text-xs text-slate-500">
                    ให้ลูกค้าสแกน QR Code หรือใช้ Token เพื่อชำระเงิน
                  </p>
                </div>

                <button
                  onClick={() => {
                    setCreatedOrder(null);
                    setQrDataUrl(null);
                    setView('pos');
                  }}
                  className="mt-4 w-full rounded-xl bg-slate-700 py-3 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  ← กลับไปสั่งรายการใหม่
                </button>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
                <span className="text-4xl">📱</span>
                <p className="text-sm">ยังไม่มี QR Code</p>
                <button
                  onClick={() => setView('pos')}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  ไปสร้าง Order
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS VIEW ── */}
        {view === 'orders' && <MerchantOrdersList />}
      </main>
    </div>
  );
}

// ─── Order History Component ───────────────────────────────────────────────────

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

  const fetchOrders = () => {
    setIsLoading(true);
    getMerchantOrders()
      .then(setOrders)
      .catch((caughtError: unknown) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'ไม่สามารถโหลดประวัติ Order ได้',
        );
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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

  // Stats
  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === 'PAID');
    const totalSales = paidOrders.reduce((sum, o) => sum + o.finalAmount, 0);
    const paidCount = paidOrders.length;
    const pendingCount = orders.filter((o) => o.status !== 'PAID').length;
    return { totalSales, paidCount, pendingCount };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (statusFilter === 'PAID' && order.status !== 'PAID') return false;
      if (statusFilter === 'PENDING' && order.status === 'PAID') return false;

      // Search filter
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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-orange-500 border-r-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
        <p className="text-sm font-semibold text-red-400 mb-2">{error}</p>
        <button
          onClick={fetchOrders}
          className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📋</span> ประวัติคำสั่งซื้อและยอดขาย
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            บันทึกคำสั่งซื้อทั้งหมดของร้านค้า ตรวจสอบยอดเงิน
            และเรียกดูใบเสร็จย้อนหลัง
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
        >
          ↻ รีเฟรชข้อมูล
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Sales */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ยอดขายที่ชำระแล้ว</span>
            <TrendingUp className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-xl font-black text-orange-400">
            {formatCurrency(stats.totalSales)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            รวมเงินสนับสนุนและเงินลูกค้า
          </p>
        </div>

        {/* Paid Orders */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ชำระสำเร็จ</span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-xl font-black text-emerald-400">
            {stats.paidCount}{' '}
            <span className="text-xs font-normal text-slate-400">ออเดอร์</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            ออกใบเสร็จและบันทึกสมบูรณ์
          </p>
        </div>

        {/* Pending Orders */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>รอลูกค้าชำระเงิน</span>
            <Clock className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 text-xl font-black text-amber-400">
            {stats.pendingCount}{' '}
            <span className="text-xs font-normal text-slate-400">ออเดอร์</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            สร้าง QR แล้วแต่ยังไม่ชำระ
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหา Order # หรือชื่อลูกค้า..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(
            [
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'PAID', label: '✓ ชำระแล้ว' },
              { id: 'PENDING', label: '⏳ รอชำระ' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === t.id
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-slate-500">
          <FileText className="size-8 text-slate-600" />
          <p className="text-sm">ไม่พบรายการคำสั่งซื้อ</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map((order) => (
            <div
              key={order.orderId}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-slate-700 hover:bg-slate-900 transition-all"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                    order.status === 'PAID'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {order.status === 'PAID' ? '✓' : '⏳'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">
                      Order #{order.orderId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        order.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {order.status === 'PAID' ? 'ชำระแล้ว' : 'รอชำระ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
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

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                <div className="text-left sm:text-right">
                  <p className="text-base font-extrabold text-orange-400 font-mono">
                    {formatCurrency(order.finalAmount)}
                  </p>
                  {order.status === 'PAID' && (
                    <p className="text-[11px] text-emerald-400 font-medium">
                      สิทธิ์ร่วมจ่าย {formatCurrency(order.subsidyAmount)}
                    </p>
                  )}
                </div>

                {order.status === 'PAID' && (
                  <button
                    type="button"
                    onClick={() => void handleOpenReceipt(order.orderId)}
                    disabled={loadingReceiptId === order.orderId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
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

      {/* Modal Receipt for Merchant */}
      {selectedReceipt && (
        <DigitalReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
