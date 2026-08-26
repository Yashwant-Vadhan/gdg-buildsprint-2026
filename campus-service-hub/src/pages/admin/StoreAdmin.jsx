import React from 'react';
import ServiceAdminPage from './ServiceAdminPage';
import { ACCENT_BY_ROLE } from '../../lib/adminTheme';

const ITEM_FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'price', label: 'Price', type: 'number' },
  { key: 'quantity_available', label: 'Qty', type: 'number' },
  { key: 'is_available', label: 'Available', type: 'boolean' },
];

export default function StoreAdmin() {
  return (
    <ServiceAdminPage
      label="Hostel Store"
      itemsTable="store_items"
      ordersTable="store_orders"
      statusFlow={['Received', 'Preparing', 'Ready', 'Collected']}
      itemFields={ITEM_FIELDS}
      accent={ACCENT_BY_ROLE.store_admin}
    />
  );
}
