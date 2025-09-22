# Git操作模块使用说明

## 概述

Git操作模块提供了使用凭证获取Git仓库分支的功能，支持多种认证方式（HTTPS、SSH、TOKEN），并集成了加密服务来安全处理敏感信息。

## 功能特性

- 🔐 **多种认证方式**：支持HTTPS（用户名/密码）、SSH（私钥）、TOKEN（访问令牌）认证
- 🛡️ **安全加密**：集成EncryptionService，安全存储和处理敏感凭证信息
- 📋 **分支获取**：获取Git仓库的所有分支信息，包括默认分支标识
- ✅ **凭证验证**：自动验证凭证有效性，确保操作成功
- 🚫 **错误处理**：完善的错误处理机制，提供详细的错误信息

## API接口

### 获取仓库分支列表

**接口地址：** `GET /git-operations/branches`

**请求参数：**
```typescript
{
  repositoryUrl: string;  // Git仓库URL
  credentialId: number;   // 凭证ID
}
```

**响应格式：**
```typescript
{
  success: boolean;
  branches?: BranchInfo[];
  defaultBranch?: string;
  error?: string;
}

interface BranchInfo {
  name: string;
  commit: string;
  isDefault: boolean;
}
```

**使用示例：**
```bash
curl -X GET "http://localhost:3000/git-operations/branches" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryUrl": "https://github.com/username/repository.git",
    "credentialId": 1
  }'
```

## 服务架构

### 核心服务

1. **GitOperationService** - Git操作核心服务
   - 位置：`src/common/services/git-operation.service.ts`
   - 功能：处理Git仓库操作，分支获取，认证配置

2. **GitCredentialsService** - Git凭证管理服务
   - 位置：`src/modules/git-credentials/git-credentials.service.ts`
   - 功能：凭证的CRUD操作，加密存储，验证

3. **EncryptionService** - 加密服务
   - 位置：`src/common/services/encryption.service.ts`
   - 功能：敏感数据的加密和解密

### 模块结构

```
src/
├── common/
│   ├── dto/
│   │   └── git-operation.dto.ts          # Git操作相关DTO
│   ├── services/
│   │   ├── git-operation.service.ts      # Git操作服务
│   │   └── git-operation.service.spec.ts # 单元测试
│   └── common.module.ts                  # 公共模块
├── modules/
│   └── git-operations/
│       ├── git-operations.controller.ts  # Git操作控制器
│       └── git-operations.module.ts      # Git操作模块
```

## 认证方式

### 1. HTTPS认证
```typescript
{
  authType: GitAuthType.HTTPS,
  username: "your-username",
  password: "your-password"  // 加密存储
}
```

### 2. SSH认证
```typescript
{
  authType: GitAuthType.SSH,
  sshKey: "-----BEGIN PRIVATE KEY-----..."  // 加密存储
}
```

### 3. TOKEN认证
```typescript
{
  authType: GitAuthType.TOKEN,
  token: "ghp_xxxxxxxxxxxx"  // 加密存储
}
```

## 错误处理

系统提供了完善的错误处理机制：

- **GitOperationException** - Git操作异常
- **无效URL格式** - 仓库URL格式验证
- **凭证验证失败** - 凭证有效性检查
- **认证信息缺失** - 必要认证信息检查
- **网络连接错误** - Git操作网络异常

## 安全特性

1. **敏感数据加密**：所有密码、令牌、SSH私钥都经过AES加密存储
2. **权限控制**：基于JWT的身份验证和权限验证
3. **输入验证**：严格的参数验证和URL格式检查
4. **临时目录管理**：自动清理临时Git操作目录

## 测试覆盖

模块包含完整的单元测试：

- ✅ URL格式验证测试
- ✅ 多种认证方式测试
- ✅ 错误处理测试
- ✅ 凭证验证测试
- ✅ 异常情况测试

运行测试：
```bash
# 运行Git操作服务测试
npm test -- --testPathPattern=git-operation.service.spec.ts

# 运行Git凭据服务测试
npm test -- --testPathPattern=git-credentials.service.spec.ts

# 运行所有测试
npm test
```

## 依赖项

- `simple-git` - Git操作库
- `@nestjs/common` - NestJS核心
- `class-validator` - 参数验证
- `class-transformer` - 数据转换

## 使用注意事项

1. **凭证管理**：确保凭证信息正确配置并通过验证
2. **网络访问**：确保服务器能够访问目标Git仓库
3. **权限要求**：使用的凭证需要有仓库的读取权限
4. **URL格式**：仓库URL必须是有效的Git URL格式
5. **临时存储**：系统会创建临时目录进行Git操作，确保有足够的磁盘空间

## 更新日志

- **v1.0.0** - 初始版本，支持基本的分支获取功能
- 支持HTTPS、SSH、TOKEN三种认证方式
- 集成加密服务保护敏感信息
- 完整的错误处理和测试覆盖