# Park.Fan API v2.0 🎢

A comprehensive NestJS API for theme park enthusiasts, providing real-time park data integration with the ThemeParks Wiki API.

## 🚀 Features

- **99+ Theme Parks**: Access to parks worldwide including Disney, Universal, Six Flags, and more
- **Real-time Wait Times**: Live attraction wait times and status updates
- **Park Information**: Detailed park data, attractions, shows, restaurants, and shops
- **Search Functionality**: Find parks by name, location, or type
- **Type-Safe**: Full TypeScript implementation with proper enums and interfaces
- **RESTful API**: Clean, well-documented endpoints following REST principles

## 🛠️ Tech Stack

- **NestJS**: Modern Node.js framework with TypeScript
- **PostgreSQL**: Robust database with TypeORM
- **Axios**: HTTP client for external API integration
- **TypeScript**: Strong typing with enums and interfaces
- **Redis**: Ready for caching implementation

## 📦 Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Start development server
pnpm run start:dev
```

## 🎯 API Endpoints

### Theme Parks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/themeparks/parks` | GET | Get all theme parks (99+ parks) |
| `/themeparks/parks/search?q=query` | GET | Search parks by name/location |
| `/themeparks/parks/:parkId` | GET | Get specific park details |
| `/themeparks/parks/:parkId/attractions` | GET | Get park attractions/shows/restaurants |
| `/themeparks/parks/:parkId/wait-times` | GET | Get real-time wait times |
| `/themeparks/parks/:parkId/show-times` | GET | Get show schedules |
| `/themeparks/parks/:parkId/schedule` | GET | Get park operating hours |
| `/themeparks/attractions/:id/wait-time` | GET | Get specific attraction wait time |

## 📊 Type Safety

The API uses strongly-typed enums for better developer experience:

```typescript
// Entity Types
enum EntityType {
  ATTRACTION = 'ATTRACTION',
  SHOW = 'SHOW',
  RESTAURANT = 'RESTAURANT',
  SHOP = 'SHOP',
  MEET_AND_GREET = 'MEET_AND_GREET',
  EXPERIENCE = 'EXPERIENCE',
  OTHER = 'OTHER'
}

// Operating Status
enum OperatingStatus {
  OPERATING = 'OPERATING',
  DOWN = 'DOWN',
  CLOSED = 'CLOSED',
  REFURBISHMENT = 'REFURBISHMENT',
  TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED'
}
```

## 🔧 Usage Examples

### Get Disney Parks
```bash
curl "http://localhost:3000/themeparks/parks/search?q=disney"
```

### Get Magic Kingdom Wait Times
```bash
curl "http://localhost:3000/themeparks/parks/75ea578a-adc8-4116-a54d-dccb60765ef9/wait-times"
```

### Example Response
```json
{
  "data": [
    {
      "id": "40737d3d-0ff6-4a9e-a050-beb87bf90120",
      "waitTime": 35,
      "status": "OPERATING",
      "active": true,
      "lastUpdated": "2025-06-26T17:22:48Z"
    }
  ],
  "lastUpdated": "2025-06-26T19:47:26.000Z"
}
```

## 🚀 Quick Start

1. **Clone the repository**
2. **Install dependencies**: `pnpm install`
3. **Start the server**: `pnpm run start:dev`
4. **Test the API**: `curl http://localhost:3000/themeparks/parks`

## 📝 Environment Variables

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=api.park.fan

# Server Configuration
PORT=3000
```

## 🧪 Testing

```bash
# Run tests
pnpm test

# Run e2e tests
pnpm test:e2e

# Test coverage
pnpm test:cov
```

## 📚 Documentation

- **ThemeParks Wiki Module**: [/src/modules/themeparks-wiki/README.md](./src/modules/themeparks-wiki/README.md)
- **API Documentation**: Available when server is running
- **Implementation Guide**: [/src/modules/themeparks-wiki/IMPLEMENTATION.md](./src/modules/themeparks-wiki/IMPLEMENTATION.md)

## 🌟 Features Coming Soon

- **Caching**: Redis integration for improved performance
- **Real-time Updates**: WebSocket support for live data
- **Analytics**: Usage statistics and popular attractions
- **Notifications**: Wait time alerts and park updates
- **Mobile App**: React Native companion app

## 📄 License

This project is licensed under the MIT License.

---

**Built with ❤️ for theme park enthusiasts**