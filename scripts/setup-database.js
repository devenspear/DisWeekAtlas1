const { PrismaClient } = require('@prisma/client')

async function setupDatabase() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔄 Connecting to database...')
    
    // Test connection
    await prisma.$connect()
    console.log('✅ Database connection successful')
    
    // Test creating a simple record
    console.log('🔄 Testing database operations...')
    
    const testJob = await prisma.jobRun.create({
      data: {
        jobType: 'database-setup-test',
        status: 'success',
        endedAt: new Date()
      }
    })
    
    console.log('✅ Database tables created and working!')
    console.log('✅ Test job created:', testJob.id)
    
    // Clean up test record
    await prisma.jobRun.delete({
      where: { id: testJob.id }
    })
    
    console.log('✅ Database setup complete!')
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message)
    
    if (error.message.includes('does not exist')) {
      console.log('\n🔧 Attempting to create database schema...')
      console.log('Run: npx prisma db push')
    }
  } finally {
    await prisma.$disconnect()
  }
}

setupDatabase()