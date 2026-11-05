import { chain, mockModel } from '../../test-utils/mocks';
import { SponsorsService } from '../sponsors.service';

describe('SponsorsService', () => {
  it('lists sponsors without mongo internals', async () => {
    const model = mockModel();
    const c = chain([{ id: '1' }]);
    model.find.mockReturnValue(c);
    const service = new SponsorsService(model as never);
    await expect(service.list()).resolves.toEqual([{ id: '1' }]);
    expect(c.select).toHaveBeenCalledWith('-_id -__v');
  });

  it('exists() reflects the model', async () => {
    const model = mockModel();
    model.exists
      .mockResolvedValueOnce({ _id: 'x' })
      .mockResolvedValueOnce(null);
    const service = new SponsorsService(model as never);
    await expect(service.exists('1')).resolves.toBe(true);
    await expect(service.exists('9')).resolves.toBe(false);
  });
});
