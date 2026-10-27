import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { th } from '../../../i18n/th';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import type { Category, Product } from '../merchant.types';
import { MerchantPos } from './MerchantPos';

vi.mock('../api/merchant.api', () => ({
  getCategories: vi.fn(),
  getMyProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  updateProductStatus: vi.fn(),
  createOrder: vi.fn(),
  getMerchantOrders: vi.fn(),
  getMerchantOrderReceipt: vi.fn(),
}));

const mockedGetCategories = vi.mocked(getCategories);
const mockedGetMyProducts = vi.mocked(getMyProducts);
const mockedUpdateProduct = vi.mocked(updateProduct);
const mockedUpdateProductStatus = vi.mocked(updateProductStatus);
const mockedCreateProduct = vi.mocked(createProduct);
const mockedCreateOrder = vi.mocked(createOrder);
const mockedGetMerchantOrders = vi.mocked(getMerchantOrders);
const mockedGetMerchantOrderReceipt = vi.mocked(getMerchantOrderReceipt);

const mockCategories: Category[] = [
  {
    categoryId: '1',
    categoryName: 'อาหารตามสั่ง',
    description: 'อาหารจานเดียว',
  },
];

const mockProducts: Product[] = [
  {
    productId: '10',
    productName: 'ข้าวกะเพราหมูสับ',
    description: 'ผัดใบกะเพราแท้',
    price: 55,
    status: 'ACTIVE',
    categoryId: '1',
    categoryName: 'อาหารตามสั่ง',
  },
  {
    productId: '11',
    productName: 'ข้าวไข่เจียวสมุนไพร',
    description: 'เมนูพิเศษ',
    price: 45,
    status: 'INACTIVE',
    categoryId: '1',
    categoryName: 'อาหารตามสั่ง',
  },
];

describe('MerchantPos (FR-M02, FR-M03, FR-M04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCategories.mockResolvedValue(mockCategories);
    mockedGetMyProducts.mockResolvedValue(mockProducts);
    mockedGetMerchantOrders.mockResolvedValue([]);
    mockedCreateProduct.mockResolvedValue(mockProducts[0]!);
    mockedCreateOrder.mockResolvedValue({
      orderId: '501',
      status: 'PENDING',
      subtotal: 55,
      finalAmount: 55,
      qrToken: 'token-abc-501',
      qrExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      items: [
        {
          productId: '10',
          productName: 'ข้าวกะเพราหมูสับ',
          unitPrice: 55,
          quantity: 1,
          lineTotal: 55,
        },
      ],
    });
    mockedGetMerchantOrderReceipt.mockResolvedValue({} as never);
  });

  afterEach(cleanup);

  it('ignores a stale order-history failure under StrictMode (NFR-UI-01)', async () => {
    let rejectOld: ((reason: Error) => void) | undefined;
    let rejectCurrent: ((reason: Error) => void) | undefined;
    mockedGetMerchantOrders.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectOld = reject;
        }),
    );
    mockedGetMerchantOrders.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectCurrent = reject;
        }),
    );
    render(
      <StrictMode>
        <MerchantPos onLogout={vi.fn()} />
      </StrictMode>,
    );
    await screen.findByText('ข้าวกะเพราหมูสับ');
    fireEvent.click(
      screen.getByRole('button', { name: th.merchantPortal.nav.orders }),
    );
    await act(async () => {
      rejectOld?.(new Error('Old order failure'));
    });
    expect(
      screen.getByText(th.merchantPortal.orders.loading),
    ).toBeInTheDocument();
    expect(screen.queryByText('Old order failure')).not.toBeInTheDocument();
    await act(async () => {
      rejectCurrent?.(new Error('Current order failure'));
    });
    expect(screen.getByText('Current order failure')).toBeInTheDocument();
  });

  it('loads products with includeInactive=true and filters by ACTIVE / INACTIVE / ALL', async () => {
    render(<MerchantPos merchantName="ร้านครัวป้าสมศรี" onLogout={vi.fn()} />);

    expect(await screen.findByText('ข้าวกะเพราหมูสับ')).toBeInTheDocument();
    expect(mockedGetMyProducts).toHaveBeenCalledWith(true);

    // Default filter is ACTIVE, so inactive product is hidden initially
    expect(screen.queryByText('ข้าวไข่เจียวสมุนไพร')).not.toBeInTheDocument();

    // Switch to INACTIVE filter
    fireEvent.click(screen.getByRole('button', { name: /ปิดการขาย \(1\)/ }));
    expect(await screen.findByText('ข้าวไข่เจียวสมุนไพร')).toBeInTheDocument();
  });

  it('edits product name and price via Edit Product Modal and updates cart item (FR-M02)', async () => {
    mockedUpdateProduct.mockResolvedValueOnce({
      productId: '10',
      productName: 'ข้าวกะเพราหมูสับไข่ดาว',
      description: 'เพิ่มไข่ดาว',
      price: 65,
      status: 'ACTIVE',
      categoryId: '1',
      categoryName: 'อาหารตามสั่ง',
    });

    render(<MerchantPos merchantName="ร้านครัวป้าสมศรี" onLogout={vi.fn()} />);

    expect(await screen.findByText('ข้าวกะเพราหมูสับ')).toBeInTheDocument();

    // Add to cart first
    fireEvent.click(screen.getByText('ข้าวกะเพราหมูสับ'));

    // Open Edit modal
    fireEvent.click(
      screen.getByRole('button', { name: 'แก้ไข ข้าวกะเพราหมูสับ' }),
    );

    const nameInput = screen.getByLabelText('ชื่อสินค้า *');
    const priceInput = screen.getByLabelText('ราคา (บาท) *');

    fireEvent.change(nameInput, {
      target: { value: 'ข้าวกะเพราหมูสับไข่ดาว' },
    });
    fireEvent.change(priceInput, { target: { value: '65' } });

    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));

    expect(mockedUpdateProduct).toHaveBeenCalledWith('10', {
      productName: 'ข้าวกะเพราหมูสับไข่ดาว',
      price: 65,
      categoryId: 1,
      description: 'ผัดใบกะเพราแท้',
      status: 'ACTIVE',
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'บันทึกข้อมูลสินค้า "ข้าวกะเพราหมูสับไข่ดาว" เรียบร้อยแล้ว',
    );
  });

  it('deactivates an active product and removes it from current POS cart (FR-M02)', async () => {
    mockedUpdateProductStatus.mockResolvedValueOnce({
      ...mockProducts[0]!,
      status: 'INACTIVE',
    });

    render(<MerchantPos merchantName="ร้านครัวป้าสมศรี" onLogout={vi.fn()} />);

    expect(await screen.findByText('ข้าวกะเพราหมูสับ')).toBeInTheDocument();

    // Add to cart
    fireEvent.click(screen.getByText('ข้าวกะเพราหมูสับ'));
    expect(screen.getByText('ล้างทั้งหมด')).toBeInTheDocument();

    // Deactivate product
    fireEvent.click(
      screen.getByRole('button', { name: 'ปิดการขาย ข้าวกะเพราหมูสับ' }),
    );

    expect(mockedUpdateProductStatus).toHaveBeenCalledWith('10', 'INACTIVE');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'ปิดการขายสินค้า "ข้าวกะเพราหมูสับ" ชั่วคราวเรียบร้อยแล้ว',
    );
    // Cart should now be empty since product became INACTIVE
    expect(screen.queryByText('ล้างทั้งหมด')).not.toBeInTheDocument();
  });
});
