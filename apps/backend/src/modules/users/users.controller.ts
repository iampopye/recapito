import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.usersService.findById(id);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateUserDto) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    const newUser = await this.usersService.createUser(dto);
    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      isAdmin: newUser.isAdmin,
      createdAt: newUser.createdAt,
    };
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    const updatedUser = await this.usersService.updateUser(id, dto);
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      isAdmin: updatedUser.isAdmin,
      updatedAt: updatedUser.updatedAt,
    };
  }

  @Delete(':id')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    if (id === user.id) {
      throw new ForbiddenException('Cannot delete your own account');
    }
    await this.usersService.deleteUser(id);
    return { success: true };
  }
}
