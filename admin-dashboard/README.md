# OTC Automation - Admin Dashboard

Modern admin dashboard for managing the multi-tenant OTC automation platform.

## Features

- **Multi-Tenant Management**: View and manage all tenants
- **Real-Time Analytics**: Live order tracking and revenue metrics
- **User Management**: KYC approval, user roles, and permissions
- **Order Monitoring**: Track all orders across tenants
- **Reconciliation Dashboard**: View balance reconciliation status
- **System Health**: Monitor backend API and external integrations
- **Audit Logs**: Complete audit trail of all actions

## Technology Stack

### Recommended Stack

- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) or Ant Design
- **State Management**: Redux Toolkit or Zustand
- **Data Fetching**: React Query
- **Charts**: Recharts or Chart.js
- **Real-Time**: Socket.io client
- **Forms**: React Hook Form with Zod validation
- **Routing**: React Router v6
- **Build Tool**: Vite

### Alternative Stack (Vue.js)

- **Framework**: Vue 3 with TypeScript
- **UI Library**: Vuetify or Element Plus
- **State Management**: Pinia
- **Data Fetching**: Vue Query
- **Charts**: Vue-ChartJS
- **Forms**: VeeValidate

## Getting Started

### Installation

```bash
# Create React app with Vite
npm create vite@latest admin-dashboard -- --template react-ts
cd admin-dashboard
npm install

# Install dependencies
npm install @mui/material @emotion/react @emotion/styled
npm install @tanstack/react-query axios
npm install react-router-dom
npm install recharts
npm install socket.io-client
npm install @hookform/resolvers zod react-hook-form
npm install dayjs
```

### Configuration

Create `.env` file:

```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_NAME=OTC Admin Dashboard
```

### Development

```bash
npm run dev
```

Visit http://localhost:5173

## Project Structure

```
src/
├── api/                      # API client and endpoints
│   ├── client.ts
│   ├── tenants.ts
│   ├── orders.ts
│   ├── users.ts
│   └── analytics.ts
├── components/               # Reusable components
│   ├── common/
│   │   ├── DataTable.tsx
│   │   ├── StatusBadge.tsx
│   │   └── LoadingSpinner.tsx
│   ├── charts/
│   │   ├── RevenueChart.tsx
│   │   └── OrdersChart.tsx
│   └── forms/
│       ├── TenantForm.tsx
│       └── UserForm.tsx
├── pages/                    # Page components
│   ├── Dashboard/
│   │   └── Dashboard.tsx
│   ├── Tenants/
│   │   ├── TenantList.tsx
│   │   └── TenantDetail.tsx
│   ├── Orders/
│   │   ├── OrderList.tsx
│   │   └── OrderDetail.tsx
│   ├── Users/
│   │   └── UserList.tsx
│   ├── Reconciliation/
│   │   └── ReconciliationList.tsx
│   └── Settings/
│       └── Settings.tsx
├── hooks/                    # Custom React hooks
│   ├── useAuth.ts
│   ├── useTenants.ts
│   └── useOrders.ts
├── store/                    # State management
│   ├── authSlice.ts
│   └── store.ts
├── types/                    # TypeScript types
│   ├── tenant.types.ts
│   ├── order.types.ts
│   └── user.types.ts
├── utils/                    # Utility functions
│   ├── formatters.ts
│   └── validators.ts
├── App.tsx                   # Main app component
└── main.tsx                  # Entry point
```

## Key Features Implementation

### 1. Authentication

```typescript
// src/hooks/useAuth.ts
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    setToken(response.data.accessToken);
    localStorage.setItem('token', response.data.accessToken);
    setUser(response.data.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return { user, token, login, logout };
};
```

### 2. Tenant Management

```typescript
// src/pages/Tenants/TenantList.tsx
import { useQuery } from '@tanstack/react-query';

export const TenantList = () => {
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.get('/tenants').then(res => res.data),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h1>Tenants</h1>
      <DataTable
        columns={[
          { field: 'name', header: 'Name' },
          { field: 'subdomain', header: 'Subdomain' },
          { field: 'status', header: 'Status' },
          { field: 'createdAt', header: 'Created' },
        ]}
        data={tenants}
      />
    </div>
  );
};
```

### 3. Real-Time Order Tracking

```typescript
// src/hooks/useRealtimeOrders.ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export const useRealtimeOrders = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL, {
      auth: { token: localStorage.getItem('token') }
    });

    socket.on('order:created', (order) => {
      setOrders(prev => [order, ...prev]);
    });

    socket.on('order:updated', (order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
    });

    return () => socket.disconnect();
  }, []);

  return orders;
};
```

### 4. Analytics Dashboard

```typescript
// src/pages/Dashboard/Dashboard.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export const Dashboard = () => {
  const { data: analytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/analytics/overview').then(res => res.data),
  });

  return (
    <div className="dashboard">
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Total Orders"
            value={analytics?.totalOrders}
            icon={<ShoppingCartIcon />}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Total Revenue"
            value={formatCurrency(analytics?.totalRevenue)}
            icon={<AttachMoneyIcon />}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Active Tenants"
            value={analytics?.activeTenants}
            icon={<BusinessIcon />}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard
            title="Success Rate"
            value={`${analytics?.successRate}%`}
            icon={<TrendingUpIcon />}
          />
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Revenue Trend" />
            <CardContent>
              <LineChart width={600} height={300} data={analytics?.revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
              </LineChart>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Recent Orders" />
            <CardContent>
              <OrdersList orders={analytics?.recentOrders} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </div>
  );
};
```

## API Integration

### API Client Setup

```typescript
// src/api/client.ts
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
```

### API Endpoints

```typescript
// src/api/tenants.ts
export const tenantsApi = {
  getAll: () => client.get('/tenants'),
  getById: (id: string) => client.get(`/tenants/${id}`),
  create: (data: CreateTenantDto) => client.post('/tenants', data),
  update: (id: string, data: UpdateTenantDto) => client.patch(`/tenants/${id}`, data),
  delete: (id: string) => client.delete(`/tenants/${id}`),
};

// src/api/orders.ts
export const ordersApi = {
  getAll: (params?: QueryParams) => client.get('/orders', { params }),
  getById: (id: string) => client.get(`/orders/${id}`),
  cancel: (id: string) => client.post(`/orders/${id}/cancel`),
};
```

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Deploy to AWS S3 + CloudFront

```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Environment Variables

### Development
```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Production
```bash
VITE_API_URL=https://api.otc-platform.com
VITE_WS_URL=wss://api.otc-platform.com
```

## Testing

```bash
# Install testing dependencies
npm install -D @testing-library/react @testing-library/jest-dom vitest

# Run tests
npm run test
```

## Security

- **HTTPS Only**: Always use HTTPS in production
- **Token Storage**: Store JWT in httpOnly cookies when possible
- **XSS Protection**: Sanitize all user inputs
- **CSRF Protection**: Implement CSRF tokens
- **Content Security Policy**: Configure CSP headers

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## License

Proprietary - All rights reserved

## Support

For support, contact: admin-support@otc-platform.com
