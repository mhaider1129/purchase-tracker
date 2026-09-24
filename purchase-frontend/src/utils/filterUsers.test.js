import { filterUsersBySearch } from './filterUsers';

const users = [
  { id: 1, name: 'Mohammed', email: 'admin@gmail.com' },
  { id: 2, name: 'Amina Yusuf', email: 'amina@example.com' },
  { id: 3, name: 'Daniel', email: null },
];

describe('filterUsersBySearch', () => {
  it('matches users by name or email without regard to case', () => {
    expect(filterUsersBySearch(users, 'YUSUF')).toEqual([users[1]]);
    expect(filterUsersBySearch(users, 'GMAIL')).toEqual([users[0]]);
  });

  it('returns all users for an empty search', () => {
    expect(filterUsersBySearch(users, '   ')).toBe(users);
  });

  it('handles missing user fields', () => {
    expect(filterUsersBySearch(users, 'daniel')).toEqual([users[2]]);
  });
});