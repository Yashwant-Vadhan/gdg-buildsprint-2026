# DESIGN — Campus Service Hub (Multi-Theme Portal)

## Design Philosophy
- **Visual Style:** Modern, clean, flat institutional styling, heavily responsive and mobile-first. Card grids use white backgrounds with light gray outlines.
- **Dynamic Accent Themes:**
  - **Canteen Canteen:** Crimson Red (`#E4002B` / `#DC2626`)
  - **Hostel Store:** Amber Orange (`#EA580C` / `#D97706`)
  - **Laundry Desk:** Electric Blue (`#2563EB` / `#1D4ED8`)
  - **Student Wallet:** Indigo Purple (`#4F46E5` / `#6366F1`)
- **Branding:** Official Anna University crest/emblem at sidebar and header.

## Information Architecture
*Unchanged, routes and role access remain identical:*
- **Day Scholar:** Canteen + Profile only.
- **Hosteller:** Canteen + Store + Laundry + Wallet + Profile.

## Screen Specifications

### Sidebar & Navigation
- **Visuals:** Clean layout containing the official Anna University Logo (crest) with:
  ```
  [Anna University Logo]
  CAMPUS
  SERVICE HUB
  ```
- Nav link background changes dynamically according to active page's theme.

### Canteen Menu & Products
- **Categories:** All, Snacks, Beverages, Sweets, Ice Cream.
- **Item Cards:** Product image, category tag, item name, price, stock available, preparation time, and action button.
- **Pricing:** Dynamic database prices. Ice cream supports variant price selections (₹20 / ₹25 / ₹30).
- **Mobile Sticky Bar:** Renders order subtotal and quick checkout triggers.

### Hostel Store
- **Palette:** Dynamic Orange theme.
- **Products:** Milkshakes (Cavin's Chocolate/Butterscotch), Ice Cream, Biscuits (Hide & Seek, Bourbon, Munch), Chips/Snacks (Lays, Murukku).

### Laundry Desk
- **Palette:** Dynamic Blue theme.
- Stepper skip conditions (drying/ironing skipped for wash_only).

### Student Wallet
- **Palette:** Dynamic Purple theme.
- Balance card and receipt uploads.
