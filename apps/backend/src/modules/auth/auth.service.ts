import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    // A self-hosted instance is reachable by anyone who finds the URL, so open
    // registration is closed by default. The very first account is always
    // allowed -- otherwise a fresh deployment could never be bootstrapped --
    // and that account becomes the administrator.
    const userCount = await this.usersService.count();
    const isFirstUser = userCount === 0;
    const registrationOpen =
      this.configService.get<string>('ALLOW_REGISTRATION', 'false').toLowerCase() === 'true';

    if (!isFirstUser && !registrationOpen) {
      throw new ForbiddenException(
        'Registration is closed on this instance. Ask an administrator to create your account, ' +
          'or set ALLOW_REGISTRATION=true to reopen it.',
      );
    }

    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      passwordHash,
      isAdmin: isFirstUser,
    });

    if (isFirstUser) {
      this.logger.log(
        `First account created (${user.email}) and granted administrator rights. ` +
          'Further registration is closed unless ALLOW_REGISTRATION=true.',
      );
    }

    const accessToken = this.generateToken(user.id);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.generateToken(user.id);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
    };
  }

  private generateToken(userId: string): string {
    return this.jwtService.sign({ sub: userId });
  }
}
