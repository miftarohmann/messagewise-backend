import { PrismaClient } from '@prisma/client';
declare global {
    var __prisma: PrismaClient | undefined;
}
/**
 * Get or create Prisma client instance
 */
export declare function getPrismaClient(): PrismaClient;
/**
 * Connect to the database
 */
export declare function connectDatabase(): Promise<void>;
/**
 * Disconnect from the database
 */
export declare function disconnectDatabase(): Promise<void>;
/**
 * Health check for database
 */
export declare function checkDatabaseHealth(): Promise<boolean>;
export declare const db: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export default db;
//# sourceMappingURL=database.d.ts.map