import { PrismaClient, Direction, MessageType, MessageCategory, MessageStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Delete existing data
  await prisma.message.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ Cleared existing data');

  // Create demo user
  const passwordHash = await bcrypt.hash('demo123', 10);

  const user = await prisma.user.create({
    data: {
      email: 'demo@messagewise.com',
      name: 'Demo User',
      passwordHash: passwordHash,
      plan: 'PRO'
    }
  });

  console.log('✅ User created:', user.email);

  // Create WhatsApp account
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      waBusinessId: 'demo_business_123',
      waPhoneNumberId: 'demo_phone_456',
      waAccessToken: 'demo_token',
      waPhoneNumber: '+6281234567890',
      accountName: 'Fashionista Store'
    }
  });

  console.log('✅ Account created:', account.accountName);

  // Create 1000 sample messages
  console.log('📨 Creating 1000 sample messages...');

  const categories: MessageCategory[] = [
    MessageCategory.MARKETING,
    MessageCategory.UTILITY,
    MessageCategory.SERVICE,
    MessageCategory.AUTHENTICATION
  ];

  const now = new Date();
  const messages = [];

  for (let i = 0; i < 1000; i++) {
    // 70% of messages in last 7 days, 30% in days 8-30
    let daysAgo: number;
    if (Math.random() < 0.7) {
      // Last 7 days - more recent
      daysAgo = Math.floor(Math.random() * 7);
    } else {
      // Days 8-30
      daysAgo = 7 + Math.floor(Math.random() * 23);
    }

    // Add random hours to spread messages throughout the day
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    const timestamp = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000 - minutesAgo * 60 * 1000);

    const category = categories[i % 4];
    const isInbound = i % 3 === 0;
    const isInFreeWindow = Math.random() > 0.4;

    let cost = 0;
    if (!isInbound && !isInFreeWindow && category !== MessageCategory.AUTHENTICATION) {
      if (category === MessageCategory.MARKETING) cost = 0.038;
      else if (category === MessageCategory.UTILITY) cost = 0.004;
      else if (category === MessageCategory.SERVICE) cost = 0.006;
    }

    messages.push({
      accountId: account.id,
      waMessageId: `msg_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      direction: isInbound ? Direction.INBOUND : Direction.OUTBOUND,
      type: MessageType.TEXT,
      category: category,
      status: MessageStatus.DELIVERED,
      timestamp: timestamp,
      isInFreeWindow: isInFreeWindow,
      cost: cost,
      conversationId: `conv_${Math.floor(i / 3)}`
    });
  }

  await prisma.message.createMany({ data: messages });

  const totalCost = messages.reduce((sum, msg) => sum + msg.cost, 0);
  const last7Days = messages.filter(m => {
    const msgDate = new Date(m.timestamp);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return msgDate >= sevenDaysAgo;
  }).length;

  console.log('✅ Created 1000 messages');
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  🎉 SEED COMPLETED!');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('Demo Account:');
  console.log('  Email: demo@messagewise.com');
  console.log('  Password: demo123');
  console.log('');
  console.log(`Total Messages: ${messages.length}`);
  console.log(`Messages in last 7 days: ${last7Days}`);
  console.log(`Total Cost: $${totalCost.toFixed(2)} (~Rp ${(totalCost * 15700).toFixed(0)})`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
