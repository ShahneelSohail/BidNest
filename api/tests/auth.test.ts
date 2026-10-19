import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { PASSWORD, app, createUser, loginAs, resetDb } from './helpers';

beforeEach(resetDb);

const newUser = { username: 'ada', email: 'ada@example.com', fullName: 'Ada Lovelace', password: PASSWORD };

describe('auth', () => {
  it('registers a user, signs them in and never returns the password hash', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(newUser).expect(201);

    expect(res.body.data).toMatchObject({ username: 'ada', email: 'ada@example.com', role: 'USER' });
    expect(res.body.data.passwordHash).toBeUndefined();
    await agent.get('/api/auth/me').expect(200);
  });

  it('rejects duplicate emails and usernames', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(201);
    await request(app).post('/api/auth/register').send({ ...newUser, username: 'other' }).expect(409);
    await request(app).post('/api/auth/register').send({ ...newUser, email: 'other@example.com', username: 'ADA' }).expect(409);
  });

  it('validates registration input', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser, password: 'short' }).expect(400);
    expect(res.body.error.message).toMatch(/at least 8/);
    await request(app).post('/api/auth/register').send({ ...newUser, email: 'not-an-email' }).expect(400);
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    const user = await createUser();
    await loginAs(user.email);
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' }).expect(400);
    await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: PASSWORD }).expect(400);
  });

  it('blocks blocked users from signing in and drops their existing session', async () => {
    const user = await createUser();
    const agent = await loginAs(user.email);
    await prisma.user.update({ where: { id: user.id }, data: { isBlocked: true } });

    await agent.get('/api/auth/me').expect(401);
    await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD }).expect(403);
  });

  it('requires authentication for the profile and clears the session on logout', async () => {
    await request(app).get('/api/auth/me').expect(401);
    const user = await createUser();
    const agent = await loginAs(user.email);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('updates the profile and changes the password', async () => {
    const user = await createUser();
    const agent = await loginAs(user.email);

    const updated = await agent.patch('/api/auth/me').send({ fullName: 'New Name', email: 'new@example.com' }).expect(200);
    expect(updated.body.data.fullName).toBe('New Name');

    await agent.post('/api/auth/change-password').send({ currentPassword: 'nope', newPassword: 'AnotherPass1!' }).expect(400);
    await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'AnotherPass1!' }).expect(204);
    await request(app).post('/api/auth/login').send({ email: 'new@example.com', password: 'AnotherPass1!' }).expect(200);
  });
});
