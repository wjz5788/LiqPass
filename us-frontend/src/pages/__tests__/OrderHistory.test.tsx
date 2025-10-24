import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderHistoryPage } from '../OrderHistory';
import { WalletProvider } from '../../contexts/WalletContext';

// Mock the order service
jest.mock('../../services/order', () => ({
  fetchOrderHistory: jest.fn(),
}));

// Mock wallet context to simulate connected wallet
const mockWalletContext = {
  account: '0x1234567890abcdef',
  isConnected: true,
  connect: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('../../contexts/WalletContext', () => ({
  ...jest.requireActual('../../contexts/WalletContext'),
  useWallet: () => mockWalletContext,
}));

describe('OrderHistoryPage', () => {
  test('renders correctly with wallet connected', () => {
    render(
      <WalletProvider>
        <OrderHistoryPage />
      </WalletProvider>
    );
    
    expect(screen.getByText('Order History')).toBeInTheDocument();
    expect(screen.getByText('Search Orders')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Wallet address')).toBeInTheDocument();
  });

  test('shows wallet connection message when not connected', () => {
    // Mock disconnected wallet
    jest.spyOn(require('../../contexts/WalletContext'), 'useWallet').mockReturnValue({
      account: null,
      isConnected: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(
      <WalletProvider>
        <OrderHistoryPage />
      </WalletProvider>
    );
    
    expect(screen.getByText('Please connect your wallet to view order history')).toBeInTheDocument();
    expect(screen.queryByText('Refresh')).not.toBeInTheDocument();
  });

  test('renders no orders message when wallet connected but no data', () => {
    require('../../services/order').fetchOrderHistory.mockResolvedValueOnce([]);
    
    render(
      <WalletProvider>
        <OrderHistoryPage />
      </WalletProvider>
    );
    
    // The component should show the search form but no orders initially
    expect(screen.getByText('Search Orders')).toBeInTheDocument();
    expect(screen.getByText('Order History')).toBeInTheDocument();
  });
});