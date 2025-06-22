# GeriFinancial

Financial management application with Israeli bank scraping capabilities.

## Project Structure

```
gerifinancial/
├── backend/               # Node.js backend
│   ├── src/
│   │   ├── config/       # Configuration setup
│   │   ├── middleware/   # Express middleware
│   │   ├── models/       # MongoDB models
│   │   └── routes/       # API routes
│   ├── .env             # Local environment variables (git-ignored)
│   └── .env.example     # Environment template
├── frontend/            # React frontend
│   └── src/
│       ├── components/  # React components
│       │   ├── auth/    # Authentication components
│       │   ├── bank/    # Bank management components
│       │   └── layout/  # Layout components
│       ├── contexts/    # React contexts
│       ├── services/    # API services
│       ├── utils/       # Utility functions
│       └── constants/   # Shared constants
├── package.json        # Root package with scripts
└── .gitignore         # Root git ignore rules
```

## Development Progress

### Phase 1: Initial Setup (Completed)

#### Backend Implementation
1. Set up Node.js project with Express
2. Integrated MongoDB with mongoose
3. Created User model with authentication
4. Created BankAccount model for storing bank credentials
5. Implemented JWT-based authentication
6. Set up israeli-bank-scrapers integration
7. Created authentication routes (register, login, profile)
8. Created bank account management routes
9. Implemented environment configuration

#### Frontend Implementation
1. Created React application with TypeScript
2. Set up Material-UI for styling
3. Implemented authentication context
4. Created login and registration forms
5. Added protected route functionality
6. Created authenticated layout with navigation
7. Set up API service layer

#### Project Configuration
1. Set up concurrent running of frontend and backend
2. Configured environment variables
3. Set up proper .gitignore files
4. Added development scripts in root package.json

### Phase 2: Bank Integration (Completed)

#### Bank Account Management
1. Implemented bank account connection UI:
   - Add bank accounts with custom names
   - View and manage connected accounts
   - Test bank connections
   - Delete accounts
   - Clean form state management

2. Security Enhancements:
   - Secure credential handling
   - No sensitive data in responses
   - Automatic credential stripping
   - Form data clearing on close
   - Protected routes and API endpoints

3. User Interface Improvements:
   - Intuitive bank account form
   - Clear status indicators
   - Error handling and display
   - Responsive design
   - User-friendly account names

4. Analytics Integration:
   - Comprehensive event tracking
   - User action monitoring
   - Error tracking
   - Success metrics
   - Development mode logging

5. Code Organization:
   - Centralized constants
   - Shared type definitions
   - Clean component structure
   - Reusable utilities
   - Analytics abstraction

## Environment Setup

1. Copy the environment template:
```bash
cp backend/.env.example backend/.env
```

2. Configure backend/.env with your settings:
```
PORT=3001
MONGODB_URI=mongodb://localhost:27777/gerifinancial
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=24h
NODE_ENV=development
```

## Installation

1. Install all dependencies (frontend and backend):
```bash
npm run install-all
```

2. Start development servers:
```bash
npm run dev
```

This will start:
- Frontend on http://localhost:3000
- Backend on http://localhost:3001
- Connects to MongoDB on port 27777

## Available Scripts

In the root directory:
- `npm run install-all`: Install dependencies for both frontend and backend
- `npm run dev`: Start both servers concurrently
- `npm run backend`: Start only the backend server
- `npm run frontend`: Start only the frontend server

## Next Steps

### Phase 3: Financial Analysis (Planned)
1. Add financial reports
2. Implement budgeting features
3. Add financial insights
4. Create data visualization
5. Add transaction categorization

## Technical Details

### Backend Stack
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication
- Israeli-bank-scrapers for bank data

### Frontend Stack
- React with TypeScript
- Material-UI components
- React Router for navigation
- Axios for API calls
- Custom form handling
- Analytics tracking

### Security Features
- JWT-based authentication
- Secure credential handling
- No sensitive data exposure
- Automatic response sanitization
- Protected routes and endpoints
- Clean form state management

### Analytics Setup
- Event-based tracking
- User action monitoring
- Error tracking
- Success metrics
- Development logging
- Extensible analytics abstraction

## Contributing

1. Create your feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
3. Push to the branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

## License

ISC License
