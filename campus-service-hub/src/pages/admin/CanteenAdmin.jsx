import React from 'react';
import ServiceAdminPage from './ServiceAdminPage';
import { ACCENT_BY_ROLE } from '../../lib/adminTheme';

const ITEM_FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'price', label: 'Price', type: 'number' },
  { key: 'quantity_available', label: 'Qty', type: 'number' },
  { key: 'prep_time_min', label: 'Prep min', type: 'number' },
  { key: 'daily_limit', label: 'Daily limit', type: 'number' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'is_available', label: 'Available', type: 'boolean' },
];

export default function CanteenAdmin() {
  return (
    <ServiceAdminPage
      label="Canteen"
      itemsTable="canteen_items"
      ordersTable="canteen_orders"
      statusFlow={['Received', 'Preparing', 'Ready', 'Collected']}
      itemFields={ITEM_FIELDS}
      accent={ACCENT_BY_ROLE.canteen_admin}
    />
  );
}
