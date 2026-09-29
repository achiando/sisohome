import { prisma } from './index'

async function testConnection() {
  try {
    console.log('Testing database connection...')
    await prisma.$connect()
    console.log('Database connection successful!')
    await prisma.$disconnect()
  } catch (error) {
    console.error('Database connection failed:', error)
    process.exit(1)
  }
}

testConnection()
