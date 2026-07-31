import { PrismaService } from '../prisma.service';
import type { PaginatedResult, PaginationOptions } from '../types';
export type { PaginatedResult, PaginationOptions } from '../types';

export interface PrismaDelegate<TEntity> {
  findUnique(args: {
    where: unknown;
    select?: unknown;
  }): Promise<TEntity | null>;
  findFirst(args: {
    where?: unknown;
    orderBy?: unknown;
    select?: unknown;
  }): Promise<TEntity | null>;
  findMany(args?: {
    where?: unknown;
    orderBy?: unknown;
    take?: number;
    skip?: number;
    select?: unknown;
  }): Promise<TEntity[]>;
  count(args?: { where?: unknown }): Promise<number>;
  create(args: { data: unknown; select?: unknown }): Promise<TEntity>;
  createMany(args: { data: unknown[]; skipDuplicates?: boolean }): Promise<{
    count: number;
  }>;
  update(args: {
    where: unknown;
    data: unknown;
    select?: unknown;
  }): Promise<TEntity>;
  updateMany(args: { where: unknown; data: unknown }): Promise<{
    count: number;
  }>;
  delete(args: { where: unknown }): Promise<TEntity>;
  deleteMany(args?: { where?: unknown }): Promise<{
    count: number;
  }>;
  upsert(args: {
    where: unknown;
    create: unknown;
    update: unknown;
    select?: unknown;
  }): Promise<TEntity>;
}

export abstract class BaseRepository<TEntity = unknown> {
  protected readonly delegate: PrismaDelegate<TEntity>;
  constructor(
    protected readonly prisma: PrismaService,
    delegate: unknown,
  ) {
    this.delegate = delegate as PrismaDelegate<TEntity>;
  }
  findById(
    id: string,
    select?: Record<string, unknown>,
  ): Promise<TEntity | null> {
    return this.delegate.findUnique({ where: { id }, select });
  }
  findOne(
    where: Record<string, unknown>,
    opts?: {
      orderBy?: unknown;
      select?: Record<string, unknown>;
    },
  ): Promise<TEntity | null> {
    return this.delegate.findFirst({
      where,
      orderBy: opts?.orderBy,
      select: opts?.select,
    });
  }
  findMany(opts?: {
    where?: Record<string, unknown>;
    orderBy?: unknown;
    take?: number;
    skip?: number;
    select?: Record<string, unknown>;
  }): Promise<TEntity[]> {
    return this.delegate.findMany({
      where: opts?.where,
      orderBy: opts?.orderBy,
      take: opts?.take,
      skip: opts?.skip,
      select: opts?.select,
    });
  }
  count(where?: Record<string, unknown>): Promise<number> {
    return this.delegate.count({ where });
  }
  async countSince(
    dateField: string,
    since: Date | string | null,
  ): Promise<number> {
    const where =
      since == null
        ? undefined
        : {
            [dateField]: {
              gte: since instanceof Date ? since : new Date(since),
            },
          };
    return this.count(where);
  }
  async countBetween(
    dateField: string,
    from: Date | string,
    to: Date | string,
  ): Promise<number> {
    const fromDate = from instanceof Date ? from : new Date(from);
    const toDate = to instanceof Date ? to : new Date(to);
    return this.count({ [dateField]: { gte: fromDate, lt: toDate } });
  }
  create(
    data: Record<string, unknown>,
    select?: Record<string, unknown>,
  ): Promise<TEntity> {
    return this.delegate.create({ data, select });
  }
  async createMany(
    data: Record<string, unknown>[],
    skipDuplicates = false,
  ): Promise<number> {
    const result = await this.delegate.createMany({ data, skipDuplicates });
    return result.count;
  }
  update(
    where: Record<string, unknown>,
    data: Record<string, unknown>,
    select?: Record<string, unknown>,
  ): Promise<TEntity> {
    return this.delegate.update({ where, data, select });
  }
  async updateMany(
    where: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<number> {
    const result = await this.delegate.updateMany({ where, data });
    return result.count;
  }
  delete(where: Record<string, unknown>): Promise<TEntity> {
    return this.delegate.delete({ where });
  }
  async deleteMany(where?: Record<string, unknown>): Promise<number> {
    const result = await this.delegate.deleteMany({ where });
    return result.count;
  }
  upsert(
    where: Record<string, unknown>,
    create: Record<string, unknown>,
    update: Record<string, unknown>,
    select?: Record<string, unknown>,
  ): Promise<TEntity> {
    return this.delegate.upsert({ where, create, update, select });
  }
  async paginate(opts: PaginationOptions): Promise<PaginatedResult<TEntity>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.delegate.findMany({
        where: opts.where,
        orderBy: opts.orderBy,
        skip,
        take: pageSize,
        select: opts.select,
      }),
      this.count(opts.where),
    ]);
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }
}
